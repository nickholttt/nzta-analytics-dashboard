"""Every Parquet file a build publishes is in a codec the site's reader can decode.

The browser reads public/data through hyparquet. src/lib/data.ts gives it only the zstd decoder (hyparquet reads snappy and
uncompressed pages itself), so a file in another codec fails to load on every chart that reads it (D-099). The writers all
say COMPRESSION ZSTD (pipeline/outputs.py), but nothing said it had to stay so. The list of codecs the reader can decode is
data: config/pipeline.json, "site_reader", and tests/site/ checks that data.ts agrees with it.
"""

from __future__ import annotations

import duckdb

from pipeline import build, config

from .conftest import NOW, load_rows, make_cfg, source_for, write_pages


def codecs_in(path) -> set[str]:
    con = duckdb.connect()
    try:
        rows = con.execute(f"SELECT DISTINCT compression FROM parquet_metadata('{path.as_posix()}')").fetchall()
    finally:
        con.close()
    return {codec for (codec,) in rows}


def test_every_parquet_file_a_build_publishes_is_in_a_codec_the_site_can_read(tmp_path, workspace):
    rows = load_rows()
    build.build(make_cfg(workspace), source_for(rows), write_pages(tmp_path / "pages", rows), None, NOW)
    readable = {c.upper() for c in config.load().pipeline["site_reader"]["codecs"]}
    files = sorted(workspace["public"].rglob("*.parquet"))
    assert files, "the build published no Parquet file, so this test would check nothing"
    unreadable = {path.relative_to(workspace["public"]).as_posix(): sorted(codecs_in(path) - readable) for path in files}
    unreadable = {name: codecs for name, codecs in unreadable.items() if codecs}
    assert not unreadable, f"files in a codec the site's reader cannot decode (config/pipeline.json, site_reader): {unreadable}"


def test_the_list_of_readable_codecs_is_not_empty_and_names_what_duckdb_reports():
    codecs = config.load().pipeline["site_reader"]["codecs"]
    assert codecs and all(c == c.upper() for c in codecs)
