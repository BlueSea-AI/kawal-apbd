import io
import json
import sys
import tempfile
import unittest
import urllib.error
from contextlib import redirect_stdout
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

import etl_pipeline as etl  # noqa: E402


def _make_djpk_xml(pend_ang: float, pend_real: float, bel_ang: float, bel_real: float) -> str:
    return (
        '<?xml version="1.0"?>'
        '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" '
        'xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">'
        "<Worksheet><Table>"
        "<Row><Cell><Data>Akun</Data></Cell><Cell><Data>Anggaran</Data></Cell><Cell><Data>Realisasi</Data></Cell></Row>"
        f"<Row><Cell><Data>Pendapatan Daerah</Data></Cell><Cell><Data>{pend_ang}</Data></Cell><Cell><Data>{pend_real}</Data></Cell></Row>"
        f"<Row><Cell><Data>Belanja Daerah</Data></Cell><Cell><Data>{bel_ang}</Data></Cell><Cell><Data>{bel_real}</Data></Cell></Row>"
        "</Table></Worksheet></Workbook>"
    )


class TestDynamicFiscalYearProbing(unittest.TestCase):
    def test_probes_downward_from_start_year_and_picks_newest_valid_year_and_latest_period(self):
        calls: list[tuple[str, int, int]] = []

        def fake_fetch(rid: str, year: int, periode: int, djpk_prov: str, djpk_pemda: str, refresh: bool, limiter):
            calls.append((rid, year, periode))
            if year == 2027:
                raise ValueError("2027 XML not published yet")
            if year == 2026 and periode >= 10:
                # 2026 P10-P12 still empty
                return rid, f"https://djpk.kemenkeu.go.id/mock/{year}/{periode}", _make_djpk_xml(0, 0, 0, 0), False
            if year == 2026 and periode == 9:
                # 2026 P9 has valid non-empty APBD data across provinces
                return rid, f"https://djpk.kemenkeu.go.id/mock/{year}/{periode}", _make_djpk_xml(50e12, 35e12, 52e12, 34e12), False
            return rid, f"https://djpk.kemenkeu.go.id/mock/{year}/{periode}", _make_djpk_xml(48e12, 45e12, 50e12, 46e12), False

        year, periode = etl.probe_latest_djpk_year_and_periode(
            start_year=2027,
            max_lookback=3,
            polite_delay=0.0,
            probe_provinces=[("prov-31", "09"), ("prov-32", "10"), ("prov-35", "13")],
            min_valid_provinces=2,
            fetch_fn=fake_fetch,
        )
        self.assertEqual((year, periode), (2026, 9))
        # Must have tried 2027 before falling back to 2026
        self.assertTrue(any(yr == 2027 for _, yr, _ in calls))
        # Must NOT have probed 2025 once 2026 succeeded
        self.assertFalse(any(yr == 2025 for _, yr, _ in calls))

    def test_requires_quorum_across_provinces_before_accepting_year_period(self):
        def fake_fetch(rid: str, year: int, periode: int, djpk_prov: str, djpk_pemda: str, refresh: bool, limiter):
            # In 2026 P12 only 1 province has data (below quorum of 2)
            if year == 2026 and periode == 12:
                if rid == "prov-31":
                    return rid, "https://djpk.kemenkeu.go.id/mock", _make_djpk_xml(70e12, 60e12, 72e12, 58e12), False
                return rid, "https://djpk.kemenkeu.go.id/mock", _make_djpk_xml(0, 0, 0, 0), False
            # In 2026 P11 all provinces have data
            if year == 2026 and periode == 11:
                return rid, "https://djpk.kemenkeu.go.id/mock", _make_djpk_xml(70e12, 55e12, 72e12, 50e12), False
            return rid, "https://djpk.kemenkeu.go.id/mock", _make_djpk_xml(0, 0, 0, 0), False

        year, periode = etl.probe_latest_djpk_year_and_periode(
            start_year=2026,
            max_lookback=2,
            polite_delay=0.0,
            probe_provinces=[("prov-31", "09"), ("prov-32", "10"), ("prov-35", "13")],
            min_valid_provinces=2,
            fetch_fn=fake_fetch,
        )
        self.assertEqual((year, periode), (2026, 11))

    def test_honors_explicit_year_and_probes_period(self):
        def fake_fetch(rid: str, year: int, periode: int, djpk_prov: str, djpk_pemda: str, refresh: bool, limiter):
            if year == 2025 and periode == 8:
                return rid, "https://djpk.kemenkeu.go.id/mock", _make_djpk_xml(40e12, 30e12, 41e12, 29e12), False
            return rid, "https://djpk.kemenkeu.go.id/mock", _make_djpk_xml(0, 0, 0, 0), False

        year, periode = etl.probe_latest_djpk_year_and_periode(
            start_year=2027,
            target_year=2025,
            polite_delay=0.0,
            probe_provinces=[("prov-31", "09"), ("prov-32", "10")],
            min_valid_provinces=2,
            fetch_fn=fake_fetch,
        )
        self.assertEqual((year, periode), (2025, 8))

    def test_raises_when_no_valid_year_found(self):
        def fake_fetch(rid: str, year: int, periode: int, djpk_prov: str, djpk_pemda: str, refresh: bool, limiter):
            return rid, "https://djpk.kemenkeu.go.id/mock", _make_djpk_xml(0, 0, 0, 0), False

        with self.assertRaises(RuntimeError):
            etl.probe_latest_djpk_year_and_periode(
                start_year=2027,
                max_lookback=1,
                polite_delay=0.0,
                probe_provinces=[("prov-31", "09")],
                min_valid_provinces=1,
                fetch_fn=fake_fetch,
            )

    def test_format_djpk_periode_labels(self):
        self.assertEqual(etl.format_djpk_periode(2025, 12), "Periode 12 (Januari–Desember TA 2025)")
        self.assertEqual(etl.format_djpk_periode(2026, 6), "Periode 6 (Januari–Juni TA 2026)")
        self.assertEqual(etl.format_djpk_periode(2026, 1), "Periode 1 (Januari TA 2026)")


class TestDynamicBpsYearSelection(unittest.TestCase):
    def test_selects_latest_available_year_key_dynamically_for_future_years(self):
        table = {
            "var": [{"val": 2207}],
            "turvar": [{"val": "0"}],
            "tahun": [
                {"val": 125, "label": "2025"},
                {"val": 128, "label": "2028"},
                {"val": 127, "label": "2027"},
            ],
            "turtahun": [{"val": 0}],
            # 2028 is listed in tahun metadata, but only 2027 and 2025 have actual non-null data
            "datacontent": {
                "3100220701250": 83.55,
                "3100220701270": 84.91,
                "3100220701280": None,
            },
        }
        val, yr = etl.lookup_bps_value(table, 3100)
        self.assertEqual(val, 84.91)
        self.assertEqual(yr, 2027)

    def test_falls_back_to_available_turtahun_and_turvar_when_preferred_ids_absent(self):
        table = {
            "var": [{"val": 192}],
            "turvar": [{"val": 999, "label": "Jumlah"}],
            "tahun": [{"val": 127, "label": "2027"}],
            "turtahun": [
                {"val": 301, "label": "Semester 1 (Maret)"},
                {"val": 302, "label": "Semester 2 (September)"},
            ],
            "datacontent": {
                "3100192999127302": 4.12,
                "3100192999127301": 4.30,
            },
        }
        val, yr = etl.lookup_bps_value(
            table,
            3100,
            preferred_turvar="434",
            preferred_turtahun=[62, 61, 63],
        )
        self.assertEqual(val, 4.12)
        self.assertEqual(yr, 2027)

    def test_detect_latest_bps_year_across_tables(self):
        bps_data = {
            "ipm_prov": {
                "var": [{"val": 2207}],
                "turvar": [{"val": "0"}],
                "tahun": [{"val": 127, "label": "2027"}, {"val": 128, "label": "2028"}],
                "turtahun": [{"val": 0}],
                "datacontent": {"3100220701270": 84.5},
            },
            "poverty_pct_prov": {
                "var": [{"val": 192}],
                "turvar": [{"val": "434"}],
                "tahun": [{"val": 126, "label": "2026"}],
                "turtahun": [{"val": 62}],
                "datacontent": {"310019243412662": 4.2},
            },
        }
        self.assertEqual(etl.detect_latest_bps_year(bps_data), 2027)


class TestBrowserHeadersAndGracefulCacheFallback(unittest.TestCase):
    def test_http_headers_include_realistic_desktop_browser_fields(self):
        self.assertIn("Mozilla/5.0", etl.HEADERS.get("User-Agent", ""))
        self.assertIn("Accept", etl.HEADERS)
        self.assertIn("id-ID", etl.HEADERS.get("Accept-Language", ""))
        self.assertEqual(etl.HEADERS.get("Referer"), "https://www.bps.go.id/")
        self.assertEqual(etl.HEADERS.get("Connection"), "keep-alive")

    def test_fetch_bps_table_falls_back_to_cache_on_http_403_during_refresh(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            bps_dir = Path(tmpdir)
            cached_payload = {
                "source_url": etl.BPS_TABLES["ipm_prov"]["url"],
                "fetched_via": "bps.go.id/statistics-table",
                "var": [{"val": 2207}],
                "vervar": [{"val": 3100, "label": "DKI Jakarta"}],
                "turvar": [{"val": "0"}],
                "tahun": [{"val": 126, "label": "2026"}],
                "turtahun": [{"val": 0}],
                "datacontent": {"3100220701260": 84.15},
            }
            cache_file = bps_dir / "ipm_prov_var2207.json"
            cache_file.write_text(json.dumps(cached_payload), encoding="utf-8")

            err_403 = urllib.error.HTTPError(
                etl.BPS_TABLES["ipm_prov"]["url"], 403, "Forbidden", hdrs=None, fp=None
            )
            buf = io.StringIO()
            with (
                mock.patch.object(etl, "RAW_BPS_DIR", bps_dir),
                mock.patch.object(etl, "http_get_bytes", side_effect=err_403),
                mock.patch.dict("os.environ", {"BPS_API_KEY": ""}, clear=False),
                redirect_stdout(buf),
            ):
                result = etl.fetch_bps_table("ipm_prov", refresh=True, polite_delay=0.0)

            self.assertEqual(result["datacontent"]["3100220701260"], 84.15)
            out = buf.getvalue()
            self.assertIn("[WARN]", out)
            self.assertIn("403", out)

    def test_fetch_bps_table_falls_back_to_cache_on_429_and_timeout_during_refresh(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            bps_dir = Path(tmpdir)
            cached_payload = {
                "source_url": etl.BPS_TABLES["ipm_prov"]["url"],
                "fetched_via": "bps.go.id/statistics-table",
                "var": [{"val": 2207}],
                "vervar": [],
                "turvar": [{"val": "0"}],
                "tahun": [{"val": 126, "label": "2026"}],
                "turtahun": [{"val": 0}],
                "datacontent": {"3100220701260": 84.15},
            }
            (bps_dir / "ipm_prov_var2207.json").write_text(json.dumps(cached_payload), encoding="utf-8")

            for exc in (
                urllib.error.HTTPError(etl.BPS_TABLES["ipm_prov"]["url"], 429, "Too Many Requests", None, None),
                TimeoutError("timed out"),
            ):
                buf = io.StringIO()
                with (
                    mock.patch.object(etl, "RAW_BPS_DIR", bps_dir),
                    mock.patch.object(etl, "http_get_bytes", side_effect=exc),
                    mock.patch.dict("os.environ", {"BPS_API_KEY": ""}, clear=False),
                    redirect_stdout(buf),
                ):
                    result = etl.fetch_bps_table("ipm_prov", refresh=True, polite_delay=0.0)
                self.assertEqual(result["datacontent"]["3100220701260"], 84.15)
                self.assertIn("[WARN]", buf.getvalue())

    def test_fetch_bps_table_raises_on_403_when_no_cache_exists(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            bps_dir = Path(tmpdir)
            err_403 = urllib.error.HTTPError(
                etl.BPS_TABLES["ipm_prov"]["url"], 403, "Forbidden", hdrs=None, fp=None
            )
            with (
                mock.patch.object(etl, "RAW_BPS_DIR", bps_dir),
                mock.patch.object(etl, "http_get_bytes", side_effect=err_403),
                mock.patch.dict("os.environ", {"BPS_API_KEY": ""}, clear=False),
            ):
                with self.assertRaises(urllib.error.HTTPError):
                    etl.fetch_bps_table("ipm_prov", refresh=True, polite_delay=0.0)

    def test_fetch_djpk_xml_falls_back_to_cache_on_http_403_during_refresh(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            djpk_dir = Path(tmpdir)
            xml_text = _make_djpk_xml(71e12, 48e12, 74e12, 43e12)
            (djpk_dir / "2026_p12_prov-31.xml").write_text(xml_text, encoding="utf-8")

            err_403 = urllib.error.HTTPError(
                "https://djpk.kemenkeu.go.id/portal/csv_apbd", 403, "Forbidden", None, None
            )
            buf = io.StringIO()
            with (
                mock.patch.object(etl, "RAW_DJPK_DIR", djpk_dir),
                mock.patch.object(etl, "http_get_bytes", side_effect=err_403) as mock_get,
                redirect_stdout(buf),
            ):
                rid, _url, returned_xml, hit_net = etl.fetch_djpk_xml(
                    "prov-31", 2026, 12, "09", "00", refresh=True, limiter=etl.PoliteRateLimiter(0.0)
                )

            self.assertEqual(rid, "prov-31")
            self.assertFalse(hit_net)
            self.assertEqual(returned_xml, xml_text)
            self.assertEqual(mock_get.call_count, 1)
            self.assertIn("[WARN]", buf.getvalue())
            self.assertIn("403", buf.getvalue())

    def test_fetch_djpk_pemda_catalog_falls_back_to_cache_on_http_403_during_refresh(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            cat_dir = Path(tmpdir)
            cached_cat = {"00": "Provinsi DKI Jakarta", "--": "--"}
            (cat_dir / "2026_prov_09.json").write_text(json.dumps(cached_cat), encoding="utf-8")

            err_403 = urllib.error.HTTPError(
                "https://djpk.kemenkeu.go.id/portal/pemda/09/2026", 403, "Forbidden", None, None
            )
            buf = io.StringIO()
            with (
                mock.patch.object(etl, "RAW_DJPK_CATALOG_DIR", cat_dir),
                mock.patch.object(etl, "http_get_bytes", side_effect=err_403),
                redirect_stdout(buf),
            ):
                data, hit_net = etl.fetch_djpk_pemda_catalog("09", 2026, refresh=True, polite_delay=0.0)

            self.assertEqual(data, cached_cat)
            self.assertFalse(hit_net)
            self.assertIn("[WARN]", buf.getvalue())


if __name__ == "__main__":
    unittest.main()
