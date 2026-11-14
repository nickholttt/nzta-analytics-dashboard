"""Tests of the local query service prototype. They need a built public/data with a fact table and are skipped
without one. Run from the repository root:

    .venv/Scripts/python.exe -m pytest scripts/query_service_prototype -q -p no:cacheprovider
"""

from __future__ import annotations

import copy
import json
import sys
from pathlib import Path

import duckdb
import pytest

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
DATA = REPO / "public" / "data"
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(REPO))

import server  # noqa: E402

pytestmark = pytest.mark.skipif(not (DATA / "facts").exists(), reason="needs a built public/data with a fact table")

SETTINGS = json.loads((HERE / "settings.json").read_text(encoding="utf-8"))


def service(**changes) -> server.Service:
    settings = copy.deepcopy(SETTINGS)
    for key, value in changes.items():
        if key in settings["limits"]:
            settings["limits"][key] = value
        else:
            settings[key] = value
    return server.Service(DATA, settings=settings)


@pytest.fixture(scope="module")
def svc() -> server.Service:
    return service()


@pytest.fixture(scope="module")
def dataset(svc) -> str:
    return next(iter(svc.public))


def ask(svc, dataset, query):
    body, meta = svc.answer(dataset, query)
    return json.loads(body), meta


def top_values(dataset, field, k):
    """The k largest values of a field in its 1-D slice: test questions take their values from the data, not code."""
    path = DATA / "cube" / dataset / f"{field}.parquet"
    rows = duckdb.sql(f"SELECT dim_value FROM read_parquet('{path.as_posix()}') GROUP BY 1 ORDER BY SUM(n) DESC LIMIT {k}").fetchall()
    return [r[0] for r in rows]


def q(svc, **parts) -> str:
    from urllib.parse import urlencode

    pairs = []
    for name, value in parts.items():
        for v in value if isinstance(value, list) else [value]:
            pairs.append((svc.prefix + name.replace("__", "."), v))
    return urlencode(pairs)


# Aggregates only --------------------------------------------------------------------------------------------------

ANSWER_KEYS = {"contract", "dataset", "snapshot", "generated_at", "definition", "fields", "warnings", "question",
               "months", "denominator", "values", "values2", "cells", "suppression"}


def test_the_service_holds_only_public_columns(svc, dataset):
    columns = {r[0] for r in svc.con.execute(f'DESCRIBE "facts_{dataset}"').fetchall()}
    assert columns == {server.MONTH, server.COUNT, "mi", *svc.public[dataset]}


def test_an_answer_is_counts_summed_over_cells(svc, dataset):
    field = svc.public[dataset][0]
    answer, _ = ask(svc, dataset, q(svc, by=field))
    assert set(answer) <= ANSWER_KEYS
    assert all(isinstance(c[-1], int) and c[-1] > 0 for c in answer["cells"])
    per_month = [0] * len(answer["months"])
    for mi, _vi, n in answer["cells"]:
        per_month[mi] += n
    # With no values chosen and no condition, the cells of each month add up to that month's total.
    assert per_month == answer["denominator"]


def test_an_answer_matches_the_published_slice(svc, dataset):
    field = svc.public[dataset][0]
    answer, _ = ask(svc, dataset, q(svc, by=field))
    path = (DATA / "cube" / dataset / f"{field}.parquet").as_posix()
    expected = {
        (m, v): n
        for m, v, n in duckdb.sql(f"SELECT strftime(month, '%Y-%m'), dim_value, n FROM read_parquet('{path}') WHERE n > 0").fetchall()
    }
    got = {(answer["months"][mi], answer["values"][vi]): n for mi, vi, n in answer["cells"]}
    assert got == expected


# Fields not on the public list are refused ------------------------------------------------------------------------

@pytest.mark.parametrize("query_field", ["region", "postcode", "vin11", "month", "n", "mi", 'make" OR 1=1 --'])
def test_a_field_not_on_the_public_list_is_refused(svc, dataset, query_field):
    for parts in ({"by": query_field}, {f"where__{query_field}": "x"}):
        with pytest.raises(server.Refused) as refused:
            svc.answer(dataset, q(svc, **parts))
        assert refused.value.status == 400


def test_a_withheld_field_is_neither_loaded_nor_served(svc, dataset):
    first = svc.public[dataset][0]
    withheld = service(withheld=[first])
    columns = {r[0] for r in withheld.con.execute(f'DESCRIBE "facts_{dataset}"').fetchall()}
    assert first not in columns
    with pytest.raises(server.Refused):
        withheld.answer(dataset, q(withheld, by=first))


def test_no_sql_reaches_the_service(svc, dataset):
    with pytest.raises(server.Refused):
        svc.answer(dataset, "sql=SELECT%201")
    with pytest.raises(server.Refused):
        svc.answer(dataset, q(svc, unknown="x"))
    # A value is a parameter, never SQL: a value with quotes is simply a value no vehicle has.
    field = svc.public[dataset][0]
    value = "x' OR '1'='1"
    answer, _ = ask(svc, dataset, q(svc, by=field, value=value))
    assert answer["values"] == [value] and answer["cells"] == []


# Limits ------------------------------------------------------------------------------------------------------------

def test_more_values_than_the_limit_are_refused(svc, dataset):
    field = svc.public[dataset][1]
    values = [f"v{i}" for i in range(svc.limits["max_values"] + 1)]
    with pytest.raises(server.Refused) as refused:
        svc.answer(dataset, q(svc, by=field, value=values))
    assert refused.value.status == 422


def test_an_answer_above_the_cell_limit_is_refused_not_cut(dataset):
    small = service(max_cells=10)
    with pytest.raises(server.Refused) as refused:
        small.answer(dataset, q(small, by=small.public[dataset][1]))
    assert refused.value.status == 422


# The minimum-count hook --------------------------------------------------------------------------------------------

def test_the_minimum_count_withholds_small_cells_and_says_so(dataset):
    base = service()
    field = base.public[dataset][1]
    floor = 1000
    ruled = service(min_count={field: floor})
    answer, _ = ask(ruled, dataset, q(ruled, by=field))
    plain, _ = ask(base, dataset, q(base, by=field))
    small = sum(1 for c in plain["cells"] if c[-1] < floor)
    assert small > 0
    assert answer["suppression"] == {"rules": {field: floor}, "cells_withheld": small}
    assert all(c[-1] is None or c[-1] >= floor for c in answer["cells"])
    assert plain["suppression"] == {"rules": {}, "cells_withheld": 0}


# The answer store, and a link, a saved question and a request being one thing --------------------------------------

def test_a_repeat_is_served_from_the_store_and_chart_settings_do_not_change_it(dataset):
    fresh = service()
    field = fresh.public[dataset][1]
    values = top_values(dataset, field, 3)
    first, meta1 = fresh.answer(dataset, q(fresh, measure="share", by=field, value=values))
    again, meta2 = fresh.answer(dataset, q(fresh, measure="count", period="10y", by=field, value=list(reversed(values))))
    assert (meta1["store"], meta2["store"]) == ("miss", "hit")
    assert first == again


def test_a_snapshot_the_service_does_not_hold_is_refused_unless_stored(svc, dataset):
    with pytest.raises(server.Refused) as refused:
        svc.answer(dataset, q(svc, snapshot="1999-01"))
    assert refused.value.status == 404


def test_the_stored_answer_survives_a_restart(tmp_path, dataset):
    one = server.Service(DATA, settings=copy.deepcopy(SETTINGS), store=tmp_path)
    body, _ = one.answer(dataset, "")
    two = server.Service(DATA, settings=copy.deepcopy(SETTINGS), store=tmp_path)
    again, meta = two.answer(dataset, "")
    assert again == body and meta["store"] == "hit"


# Invariant 1 -------------------------------------------------------------------------------------------------------

def test_no_domain_value_is_written_in_the_prototype():
    from pipeline.tests.test_invariants import domain_values, string_constants

    vocabulary = domain_values()
    offenders = {p.name: sorted(string_constants(p) & vocabulary) for p in sorted(HERE.glob("*.py"))}
    assert not {k: v for k, v in offenders.items() if v}
