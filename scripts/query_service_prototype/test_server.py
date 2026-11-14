"""Tests of the local query service prototype. They need a built public/data with a fact table and are skipped
without one. Run from the repository root:

    .venv/Scripts/python.exe -m pytest scripts/query_service_prototype -q -p no:cacheprovider
"""

from __future__ import annotations

import copy
import json
import re
import sys
from pathlib import Path
from urllib.parse import parse_qsl, urlencode

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


def test_a_value_named_twice_counts_once(svc, dataset):
    field = svc.public[dataset][1]
    value = top_values(dataset, field, 1)[0]
    answer, _ = ask(svc, dataset, q(svc, by=svc.public[dataset][0], **{f"where__{field}": [value] * (svc.limits["max_condition_values"] + 1)}))
    assert answer["question"].count(value.replace(" ", "+")) == 1


def test_build_can_ask_every_field_at_once(svc, dataset):
    fields = svc.public[dataset]
    conditions = {f"where__{f}": top_values(dataset, f, 1) for f in fields[1:]}
    answer, _ = ask(svc, dataset, q(svc, by=fields[0], **conditions))
    assert len(answer["denominator"]) == len(answer["months"])


@pytest.mark.parametrize("snapshot", ["2026-10\n", "2026-1", "２０２６-10", "../x"])
def test_a_snapshot_is_exactly_a_year_and_month(svc, dataset, snapshot):
    with pytest.raises(server.Refused) as refused:
        svc.answer(dataset, q(svc, snapshot=snapshot))
    assert refused.value.status == 400


def test_the_values_limit_is_at_least_builds_own_cap(svc):
    """The service must answer every comparison Build can ask: its cap on values compared is read from Build's source,
    not written here, so raising one without the other fails."""
    source = (REPO / "src" / "lib" / "builder.ts").read_text(encoding="utf-8")
    found = re.search(r"export const MAX_VALUES\s*=\s*(\d+)\s*;", source)
    assert found, "MAX_VALUES not found in src/lib/builder.ts"
    assert svc.limits["max_values"] >= int(found.group(1))


# The shared cases (cases.json): what any implementation must refuse, and some answers it must give ----------------

CASES = json.loads((HERE / "cases.json").read_text(encoding="utf-8"))


def case_query(case: dict) -> str:
    pairs = parse_qsl(case["query"], keep_blank_values=True)
    for g in case.get("generate", []):
        for i in range(g["count"]):
            value = g["same"] * g.get("repeat", 1) if "same" in g else f"{g['prefix']}{i}"
            pairs.append((g["key"], value))
    return urlencode(pairs)


@pytest.fixture(scope="module")
def services():
    made: dict[str, server.Service] = {}

    def get(overrides: dict) -> server.Service:
        key = json.dumps(overrides, sort_keys=True)
        if key not in made:
            made[key] = service(**overrides)
        return made[key]

    return get


@pytest.mark.parametrize("case", CASES["cases"], ids=[c["id"] for c in CASES["cases"]])
def test_shared_case(services, case):
    s = services(case.get("settings", {}))
    query = case_query(case)
    if case["status"] != 200:
        with pytest.raises(server.Refused) as refused:
            s.answer(CASES["dataset"], query)
        assert refused.value.status == case["status"]
        return
    body, _ = s.answer(CASES["dataset"], query)
    answer = json.loads(body)
    totals = case.get("totals")
    if not totals or totals["snapshot"] != answer["snapshot"]:
        return
    assert sum(answer["denominator"]) == totals["denominator_sum"]
    sums: dict[str, int] = {}
    for cell in answer.get("cells", []):
        name = answer["values"][cell[1]]
        sums[name] = sums.get(name, 0) + cell[-1]
    assert sums == totals["value_sums"]


def test_the_store_in_memory_has_a_cap(dataset):
    small = service(max_answers_in_memory=2)
    field = small.public[dataset][0]
    for v in ("a", "b", "c"):
        small.answer(dataset, q(small, by=field, value=v))
    assert len(small.answers) == 2


def test_an_answer_above_the_cell_limit_is_refused_not_cut(dataset):
    small = service(max_cells=10)
    with pytest.raises(server.Refused) as refused:
        small.answer(dataset, q(small, by=small.public[dataset][1]))
    assert refused.value.status == 422


# The minimum-count hook --------------------------------------------------------------------------------------------

FLOOR = 1000


@pytest.fixture(scope="module")
def ruled(svc, dataset):
    field = svc.public[dataset][1]
    return field, service(min_count={field: FLOOR})


def test_the_minimum_count_withholds_small_cells_and_says_so(svc, dataset, ruled):
    field, rs = ruled
    answer, _ = ask(rs, dataset, q(rs, by=field))
    plain, _ = ask(svc, dataset, q(svc, by=field))
    small = sum(1 for c in plain["cells"] if c[-1] < FLOOR)
    assert small > 0
    assert answer["suppression"]["rules"] == {field: FLOOR}
    assert answer["suppression"]["cells_withheld"] == small
    assert all(c[-1] is None or c[-1] >= FLOOR for c in answer["cells"])
    assert all(t is None or t == 0 or t >= FLOOR for t in answer["denominator"])
    assert plain["suppression"] == {"rules": {}, "cells_withheld": 0, "totals_withheld": 0}


def test_a_value_with_no_figure_shown_is_not_listed(svc, dataset, ruled):
    field, rs = ruled
    answer, _ = ask(rs, dataset, q(rs, by=field))
    shown = {answer["values"][c[1]] for c in answer["cells"] if c[-1] is not None}
    assert set(answer["values"]) == shown


def test_a_ruled_field_asked_only_as_a_condition_has_its_totals_withheld(dataset, ruled):
    field, rs = ruled
    rarest = duckdb.sql(
        f"SELECT dim_value FROM read_parquet('{(DATA / 'cube' / dataset / (field + '.parquet')).as_posix()}') "
        "GROUP BY 1 HAVING SUM(n) > 0 ORDER BY SUM(n) LIMIT 1"
    ).fetchone()[0]
    answer, _ = ask(rs, dataset, q(rs, **{f"where__{field}": rarest}))
    assert answer["suppression"]["totals_withheld"] > 0
    assert all(t is None or t == 0 or t >= FLOOR for t in answer["denominator"])


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


def test_a_month_built_again_replaces_its_stored_answers(tmp_path, dataset):
    one = server.Service(DATA, settings=copy.deepcopy(SETTINGS), store=tmp_path)
    one.answer(dataset, "")
    # As if the same month had been built again: the folder says it came from another build.
    (tmp_path / one.snapshot / "build.txt").write_text("an earlier build", encoding="utf-8")
    two = server.Service(DATA, settings=copy.deepcopy(SETTINGS), store=tmp_path)
    _, meta = two.answer(dataset, "")
    assert meta["store"] == "miss"


# Invariant 1 -------------------------------------------------------------------------------------------------------

def test_no_domain_value_is_written_in_the_prototype():
    from pipeline.tests.test_invariants import domain_values, string_constants

    vocabulary = domain_values()
    offenders = {p.name: sorted(string_constants(p) & vocabulary) for p in sorted(HERE.glob("*.py"))}
    assert not {k: v for k, v in offenders.items() if v}
