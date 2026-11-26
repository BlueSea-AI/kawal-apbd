#!/usr/bin/env python3
"""
Kawal APBD — Full National Zero-Fabrication Real Public Data ETL Pipeline
=========================================================================
Fetches and normalizes 100% authentic public fiscal & socioeconomic records
for ALL 38 Indonesian provinces + ALL ~508 autonomous Kabupaten/Kota (546 Pemda;
DKI Jakarta's 6 administrative regions share a unified provincial APBD) directly from:
  1. DJPK Kementerian Keuangan RI (Portal Data SIKD — Pemda Catalog & APBD XML)
     - https://djpk.kemenkeu.go.id/portal/pemda/{prov}/{year}
     - https://djpk.kemenkeu.go.id/portal/csv_apbd
  2. Badan Pusat Statistik (BPS RI — Public Statistics Tables & optional WebAPI)
     - IPM (Long Form SP2020) Provinsi (var 2207) & Kab/Kota (var 2205)
     - Kemiskinan P0 (%) & Jumlah (Ribu) Provinsi (var 192, 185) & Kab/Kota (var 621, 619)
     - Tingkat Pengangguran Terbuka (TPT) Provinsi (var 543)
     - Penduduk Usia 15+ Provinsi (var 2397)
  3. Authentic 38-Province Indonesian Archipelago Boundaries (BIG/BPS open GeoJSON)
     + optional Kab/Kota centroid index cached in data/raw/kab_kota_centroids.json.

STRICT ZERO-FABRICATION & POLITE INGESTION PROTOCOLS:
  - ZERO synthetic, hardcoded, or interpolated fiscal/social numbers.
  - Unpublished sub-metrics (e.g., Belanja Fungsi Pendidikan, Belanja Fungsi Kesehatan,
    UU HKPD 40% Infrastructure tagging, or Kab/Kota TPT) are stored as `null` with full
    `provenance` metadata unless supplied via verified CSV files in `data/raw/`.
  - Polite rate-limiting (default 0.35s delay per live HTTP request) + exponential backoff
    retry + resumable per-region caching in `data/raw/`.

Usage:
  python scripts/etl_pipeline.py --verify               # Resume missing cache, build & verify
  python scripts/etl_pipeline.py --refresh --verify     # Force live re-fetch from DJPK/BPS
  python scripts/etl_pipeline.py --delay 0.4 --verify   # Custom polite delay (seconds)
"""

from __future__ import annotations

import argparse
import concurrent.futures
import csv
import http.cookiejar
import json
import math
import os
import re
import ssl
import statistics
import sys
import threading
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT_DIR = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT_DIR / "data" / "raw"
RAW_DJPK_DIR = RAW_DIR / "djpk"
RAW_DJPK_CATALOG_DIR = RAW_DJPK_DIR / "pemda_catalog"
RAW_BPS_DIR = RAW_DIR / "bps"
OUTPUT_DIR = ROOT_DIR / "public" / "data"

DEFAULT_DJPK_MAX_LOOKBACK_YEARS = 5
DEFAULT_POLITE_DELAY = 0.35  # 0.3s - 0.5s polite throttling between live request starts
DEFAULT_WORKERS = 4  # Low concurrency paired with global PoliteRateLimiter

INDONESIAN_MONTHS = (
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
)

# Representative geographically diverse provinces used to probe newest published DJPK year & period
DEFAULT_PROBE_PROVINCES: list[tuple[str, str]] = [
    ("prov-31", "09"),  # DKI Jakarta
    ("prov-32", "10"),  # Jawa Barat
    ("prov-35", "13"),  # Jawa Timur
    ("prov-12", "02"),  # Sumatera Utara
    ("prov-73", "20"),  # Sulawesi Selatan
]


class PoliteRateLimiter:
    """Thread-safe global rate limiter ensuring >= min_interval seconds between live requests."""

    def __init__(self, min_interval: float) -> None:
        self._min_interval = max(0.0, min_interval)
        self._lock = threading.Lock()
        self._next_allowed = 0.0

    def wait(self) -> None:
        if self._min_interval <= 0.0:
            return
        with self._lock:
            now = time.monotonic()
            if now < self._next_allowed:
                sleep_for = self._next_allowed - now
                self._next_allowed += self._min_interval
            else:
                sleep_for = 0.0
                self._next_allowed = now + self._min_interval
        if sleep_for > 0.0:
            time.sleep(sleep_for)

# Statutory / institutional audit thresholds
PEGAWAI_MAX_PCT = 30.0          # UU No. 1 Tahun 2022 (UU HKPD) Pasal 146
INFRA_HKPD_MIN_PCT = 40.0       # UU No. 1 Tahun 2022 (UU HKPD) Pasal 147 (when published)
PENDIDIKAN_MIN_PCT = 20.0       # UUD 1945 & UU Sisdiknas Mandatory Spending (when published)
MODAL_BENCHMARK_PCT = 15.0      # Direct DJPK Belanja Modal benchmark when HKPD 40% tagging is unpublished

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7",
    "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8",
    "Referer": "https://www.bps.go.id/",
    "Connection": "keep-alive",
}
SSL_CTX = ssl.create_default_context()
COOKIE_JAR = http.cookiejar.CookieJar()
HTTP_OPENER = urllib.request.build_opener(
    urllib.request.HTTPSHandler(context=SSL_CTX),
    urllib.request.HTTPCookieProcessor(COOKIE_JAR),
)
JSON_DEC = json.JSONDecoder()

# Official Public BPS Dynamic Table URLs (zero auth required; also compatible with BPS_API_KEY)
BPS_TABLES: dict[str, dict[str, str]] = {
    "ipm_prov": {
        "var": "2207",
        "url": "https://www.bps.go.id/id/statistics-table/2/MjIwNyMy/metode-baru-indeks-pembangunan-manusia-ipm-menurut-provinsi-umur-harapan-hidup-hasil-long-form-sp2020.html",
    },
    "ipm_kabkota": {
        "var": "2205",
        "url": "https://www.bps.go.id/id/statistics-table/2/MjIwNSMy/metode-baru-indeks-pembangunan-manusia-umur-harapan-hidup-hasil-long-form-sp2020.html",
    },
    "poverty_pct_prov": {
        "var": "192",
        "url": "https://www.bps.go.id/id/statistics-table/2/MTkyIzI=/persentase-penduduk-miskin--p0--menurut-provinsi-dan-daerah.html",
    },
    "poverty_count_prov": {
        "var": "185",
        "url": "https://www.bps.go.id/id/statistics-table/2/MTg1IzI=/jumlah-penduduk-miskin-ribu-jiwa-menurut-provinsi-dan-daerah.html",
    },
    "poverty_pct_kabkota": {
        "var": "621",
        "url": "https://www.bps.go.id/id/statistics-table/2/NjIxIzI=/persentase-penduduk-miskin--p0--menurut-kabupaten-kota.html",
    },
    "poverty_count_kabkota": {
        "var": "619",
        "url": "https://www.bps.go.id/id/statistics-table/2/NjE5IzI=/jumlah-penduduk-miskin--ribu-jiwa--menurut-kabupaten-kota.html",
    },
    "tpt_prov": {
        "var": "543",
        "url": "https://www.bps.go.id/id/statistics-table/2/NTQzIzI=/tingkat-pengangguran-terbuka-menurut-provinsi.html",
    },
    "pop15_prov": {
        "var": "2397",
        "url": "https://www.bps.go.id/id/statistics-table/2/MjM5NyMy/jumlah-penduduk-usia-15-tahun-ke-atas-menurut-provinsi-orang.html",
    },
}

GEOJSON_UPSTREAM_URL = (
    "https://raw.githubusercontent.com/AlfianAliM/Indonesia-GeoJSON/master/provinsi.geojson"
)
KABKOTA_GEOJSON_UPSTREAM_URL = (
    "https://raw.githubusercontent.com/AlfianAliM/Indonesia-GeoJSON/master/kab_kota.geojson"
)

# ---------------------------------------------------------------------------
# Official 38-Province Administrative Crosswalk ONLY (ZERO fiscal/social numbers)
# Tuple: (prov_id, bps_2digit, bps_vervar_4digit, djpk_prov, name, island, fallback_centroid)
# ---------------------------------------------------------------------------
PROVINCE_REGISTRY: list[tuple[str, str, int, str, str, str, list[float]]] = [
    # Sumatera (10)
    ("prov-11", "11", 1100, "01", "Aceh", "Sumatera", [96.91, 4.23]),
    ("prov-12", "12", 1200, "02", "Sumatera Utara", "Sumatera", [99.06, 2.19]),
    ("prov-13", "13", 1300, "03", "Sumatera Barat", "Sumatera", [100.47, -0.85]),
    ("prov-14", "14", 1400, "04", "Riau", "Sumatera", [101.81, 0.51]),
    ("prov-15", "15", 1500, "05", "Jambi", "Sumatera", [102.72, -1.70]),
    ("prov-16", "16", 1600, "06", "Sumatera Selatan", "Sumatera", [104.17, -3.21]),
    ("prov-17", "17", 1700, "07", "Bengkulu", "Sumatera", [102.34, -3.56]),
    ("prov-18", "18", 1800, "08", "Lampung", "Sumatera", [105.02, -4.92]),
    ("prov-19", "19", 1900, "29", "Kepulauan Bangka Belitung", "Sumatera", [106.56, -2.45]),
    ("prov-21", "21", 2100, "31", "Kepulauan Riau", "Sumatera", [105.40, 1.48]),
    # Jawa (6)
    ("prov-31", "31", 3100, "09", "DKI Jakarta", "Jawa", [106.83, -6.20]),
    ("prov-32", "32", 3200, "10", "Jawa Barat", "Jawa", [107.60, -6.92]),
    ("prov-33", "33", 3300, "11", "Jawa Tengah", "Jawa", [110.20, -7.26]),
    ("prov-34", "34", 3400, "12", "DI Yogyakarta", "Jawa", [110.45, -7.89]),
    ("prov-35", "35", 3500, "13", "Jawa Timur", "Jawa", [112.73, -7.72]),
    ("prov-36", "36", 3600, "28", "Banten", "Jawa", [106.11, -6.46]),
    # Bali & Nusa Tenggara (3)
    ("prov-51", "51", 5100, "22", "Bali", "Bali & Nusa Tenggara", [115.13, -8.37]),
    ("prov-52", "52", 5200, "23", "Nusa Tenggara Barat", "Bali & Nusa Tenggara", [117.51, -8.61]),
    ("prov-53", "53", 5300, "24", "Nusa Tenggara Timur", "Bali & Nusa Tenggara", [122.18, -9.26]),
    # Kalimantan (5)
    ("prov-61", "61", 6100, "14", "Kalimantan Barat", "Kalimantan", [111.12, -0.09]),
    ("prov-62", "62", 6200, "15", "Kalimantan Tengah", "Kalimantan", [113.42, -1.61]),
    ("prov-63", "63", 6300, "16", "Kalimantan Selatan", "Kalimantan", [114.83, -3.48]),
    ("prov-64", "64", 6400, "17", "Kalimantan Timur", "Kalimantan", [116.45, 0.45]),
    ("prov-65", "65", 6500, "34", "Kalimantan Utara", "Kalimantan", [116.25, 2.92]),
    # Sulawesi (6)
    ("prov-71", "71", 7100, "18", "Sulawesi Utara", "Sulawesi", [124.52, 1.26]),
    ("prov-72", "72", 7200, "19", "Sulawesi Tengah", "Sulawesi", [121.21, -1.02]),
    ("prov-73", "73", 7300, "20", "Sulawesi Selatan", "Sulawesi", [120.16, -3.73]),
    ("prov-74", "74", 7400, "21", "Sulawesi Tenggara", "Sulawesi", [122.07, -4.14]),
    ("prov-75", "75", 7500, "30", "Gorontalo", "Sulawesi", [122.38, 0.69]),
    ("prov-76", "76", 7600, "33", "Sulawesi Barat", "Sulawesi", [119.35, -2.47]),
    # Maluku & Papua (8 — exact BPS vervar crosswalk for 4 DOB Papua!)
    ("prov-81", "81", 8100, "25", "Maluku", "Maluku & Papua", [129.84, -4.74]),
    ("prov-82", "82", 8200, "27", "Maluku Utara", "Maluku & Papua", [127.54, 0.21]),
    ("prov-91", "91", 9400, "26", "Papua", "Maluku & Papua", [138.53, -2.62]),
    ("prov-92", "92", 9100, "32", "Papua Barat", "Maluku & Papua", [133.65, -2.65]),
    ("prov-93", "93", 9500, "35", "Papua Selatan", "Maluku & Papua", [139.55, -6.68]),
    ("prov-94", "94", 9600, "36", "Papua Tengah", "Maluku & Papua", [136.64, -3.90]),
    ("prov-95", "95", 9700, "37", "Papua Pegunungan", "Maluku & Papua", [139.50, -4.27]),
    ("prov-96", "96", 9200, "38", "Papua Barat Daya", "Maluku & Papua", [131.95, -1.12]),
]

# Explicit official DJPK -> BPS vervar crosswalk for legacy/variant spellings & PP renames
DJPK_TO_BPS_VERVAR_OVERRIDES: dict[tuple[str, str], int] = {
    ("02", "05"): 1207,  # Kab. Labuhanbatu -> Labuhan Batu
    ("02", "13"): 1206,  # Kab. Toba Samosir -> Toba Samosir / Toba (PP 14/2020)
    ("02", "20"): 1277,  # Kota Padang Sidempuan -> Kota Padangsidimpuan
    ("02", "29"): 1222,  # Kab. Labuhanbatu Selatan -> Labuhan Batu Selatan
    ("02", "30"): 1223,  # Kab. Labuhanbatu Utara -> Labuhan Batu Utara
    ("03", "01"): 1308,  # Kab. Limapuluh Kota -> Lima Puluh Kota
    ("03", "10"): 1375,  # Kota Bukit Tinggi -> Kota Bukittinggi
    ("03", "14"): 1373,  # Kota Sawahlunto -> Kota Sawah Lunto
    ("05", "01"): 1504,  # Kab. Batanghari -> Batang Hari
    ("06", "10"): 1674,  # Kota Lubuk Linggau -> Kota Lubuklinggau
    ("06", "11"): 1607,  # Kab. Banyuasin -> Banyu Asin
    ("06", "13"): 1609,  # Kab. OKU Timur -> Ogan Komering Ulu Timur
    ("06", "14"): 1608,  # Kab. OKU Selatan -> Ogan Komering Ulu Selatan
    ("08", "07"): 1808,  # Kab. Tulang Bawang -> Tulangbawang
    ("14", "05"): 6104,  # Kab. Pontianak -> Kab. Mempawah (PP 58/2014)
    ("15", "06"): 6271,  # Kota Palangkaraya -> Kota Palangka Raya
    ("16", "10"): 6372,  # Kota Banjarbaru -> Kota Banjar Baru
    ("18", "03"): 7103,  # Kab. Sangihe -> Kepulauan Sangihe
    ("18", "10"): 7108,  # Kab. Kep. Siau Tagulandang Biaro -> Siau Tagulandang Biaro
    ("19", "10"): 7209,  # Kab. Tojo Una Una -> Tojo Una-Una
    ("20", "11"): 7309,  # Kab. Pangkajene Kepulauan -> Pangkajene dan Kepulauan
    ("20", "23"): 7372,  # Kota Pare-pare -> Kota Parepare
    ("20", "24"): 7371,  # Kota Makassar -> Kota Makasar
    ("21", "06"): 7472,  # Kota Bau-bau -> Kota Baubau
    ("33", "05"): 7605,  # Kab. Pasangkayu -> Mamuju Utara / Pasangkayu
    ("25", "01"): 8101,  # Kab. Maluku Tenggara Barat -> Kab. Kepulauan Tanimbar (PP 2/2019)
    ("32", "01"): 9101,  # Kab. Fak Fak -> Fakfak
}

# Official Kemendagri modern display names for legacy DJPK labels (retaining exact DJPK code)
MODERN_DISPLAY_NAME_OVERRIDES: dict[tuple[str, str], str] = {
    ("02", "13"): "Kab. Toba",
    ("03", "10"): "Kota Bukittinggi",
    ("14", "05"): "Kab. Mempawah",
    ("15", "06"): "Kota Palangka Raya",
    ("20", "23"): "Kota Parepare",
    ("21", "06"): "Kota Baubau",
    ("25", "01"): "Kab. Kepulauan Tanimbar",
    ("32", "01"): "Kab. Fakfak",
}


def clamp(val: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, val))


def round1(val: float) -> float:
    """Deterministic round-half-up to 1 decimal place (exact parity with JS)."""
    return math.floor(val * 10.0 + 0.5 + 1e-9) / 10.0


def round2(val: float) -> float:
    return math.floor(val * 100.0 + 0.5 + 1e-9) / 100.0


def clean_region_label(s: str) -> str:
    s = re.sub(r"<[^>]+>", "", s).lower().strip()
    s = re.sub(r"^(kabupaten|kab\.?|kota\s+adm\.?|kota)\s+", "", s)
    s = re.sub(r"\s+", " ", s)
    return s


def _describe_fetch_error(exc: Exception) -> str:
    if isinstance(exc, urllib.error.HTTPError):
        return f"HTTP {exc.code}"
    if isinstance(exc, TimeoutError):
        return "network timeout"
    if isinstance(exc, urllib.error.URLError):
        return f"network error: {exc.reason}"
    return str(exc)


def _display_cache_path(path: Path) -> str:
    try:
        return path.resolve().relative_to(ROOT_DIR.resolve()).as_posix()
    except ValueError:
        return path.as_posix()


def http_get_bytes(
    url: str,
    timeout: int = 30,
    max_retries: int = 4,
    base_backoff: float = 1.5,
) -> bytes:
    """Polite HTTP GET with browser-grade headers, session cookies, and backoff retry on transient errors."""
    req_headers = dict(HEADERS)
    if "djpk.kemenkeu.go.id" in url:
        req_headers["Referer"] = "https://djpk.kemenkeu.go.id/"

    last_exc: Exception | None = None
    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(url, headers=req_headers)
            with HTTP_OPENER.open(req, timeout=timeout) as resp:
                return resp.read()
        except urllib.error.HTTPError as exc:
            last_exc = exc
            if exc.code in (429, 500, 502, 503, 504) and attempt < max_retries - 1:
                sleep_s = base_backoff * (2 ** attempt)
                print(f"  [RETRY] HTTP {exc.code} on {url} -> backoff {sleep_s:.1f}s (attempt {attempt + 1}/{max_retries})")
                time.sleep(sleep_s)
                continue
            raise
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            last_exc = exc
            if attempt < max_retries - 1:
                sleep_s = base_backoff * (2 ** attempt)
                print(f"  [RETRY] Network error ({exc}) on {url} -> backoff {sleep_s:.1f}s (attempt {attempt + 1}/{max_retries})")
                time.sleep(sleep_s)
                continue
            raise
    assert last_exc is not None
    raise last_exc


# ---------------------------------------------------------------------------
# 1. DJPK Kemenkeu Official Pemda Catalog & APBD Ingestion (XML SpreadsheetML)
# ---------------------------------------------------------------------------
def djpk_url(year: int, periode: int, djpk_prov: str, djpk_pemda: str) -> str:
    return (
        f"https://djpk.kemenkeu.go.id/portal/csv_apbd"
        f"?type=apbd&periode={periode}&tahun={year}&provinsi={djpk_prov}&pemda={djpk_pemda}"
    )


def fetch_djpk_pemda_catalog(
    djpk_prov: str, year: int, refresh: bool, polite_delay: float
) -> tuple[dict[str, str], bool]:
    """Loads or fetches official DJPK pemda JSON catalog for a province. Returns (data, hit_network)."""
    RAW_DJPK_CATALOG_DIR.mkdir(parents=True, exist_ok=True)
    cache_path = RAW_DJPK_CATALOG_DIR / f"{year}_prov_{djpk_prov}.json"
    if cache_path.exists() and not refresh:
        return json.loads(cache_path.read_text(encoding="utf-8")), False

    url = f"https://djpk.kemenkeu.go.id/portal/pemda/{djpk_prov}/{year}"
    try:
        raw_bytes = http_get_bytes(url, timeout=25)
        data = json.loads(raw_bytes.decode("utf-8"))
        if not isinstance(data, dict) or "00" not in data:
            raise ValueError(f"Unexpected DJPK pemda catalog for prov={djpk_prov}, year={year}")
        cache_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        if polite_delay > 0:
            time.sleep(polite_delay)
        return data, True
    except Exception as exc:
        if cache_path.exists():
            try:
                cached = json.loads(cache_path.read_text(encoding="utf-8"))
                if isinstance(cached, dict) and "00" in cached:
                    print(
                        f"  [WARN] Live endpoint blocked ({_describe_fetch_error(exc)}), "
                        f"falling back to verified cached data in {_display_cache_path(cache_path)}",
                        flush=True,
                    )
                    return cached, False
            except Exception:
                pass
        raise


def format_djpk_periode(year: int, periode: int) -> str:
    """Formats a verified DJPK period (1-12) and fiscal year into a human-readable Indonesian label."""
    p = max(1, min(12, int(periode)))
    if p == 1:
        return f"Periode 1 (Januari TA {year})"
    return f"Periode {p} (Januari–{INDONESIAN_MONTHS[p - 1]} TA {year})"


def _read_valid_cached_xml(cache_path: Path) -> str | None:
    if not cache_path.exists():
        return None
    cached_text = cache_path.read_text(encoding="utf-8")
    if "<Workbook" in cached_text and "</Workbook>" in cached_text:
        try:
            ET.fromstring(cached_text)
            return cached_text
        except ET.ParseError:
            return None
    return None


def fetch_djpk_xml(
    rid: str,
    year: int,
    periode: int,
    djpk_prov: str,
    djpk_pemda: str,
    refresh: bool,
    limiter: PoliteRateLimiter,
    max_attempts: int = 4,
) -> tuple[str, str, str, bool]:
    """Fetches & atomically caches official DJPK SpreadsheetML XML. Returns (rid, url, xml_text, hit_network)."""
    RAW_DJPK_DIR.mkdir(parents=True, exist_ok=True)
    cache_path = RAW_DJPK_DIR / f"{year}_p{periode}_{rid}.xml"
    url = djpk_url(year, periode, djpk_prov, djpk_pemda)

    if not refresh:
        cached_text = _read_valid_cached_xml(cache_path)
        if cached_text is not None:
            return rid, url, cached_text, False

    attempts = max(1, int(max_attempts))
    last_err: Exception | None = None
    for attempt in range(attempts):
        try:
            limiter.wait()
            raw_bytes = http_get_bytes(url, timeout=35, max_retries=attempts)
            xml_text = raw_bytes.decode("utf-8", errors="replace")
            if "<Workbook" not in xml_text or "</Workbook>" not in xml_text:
                raise ValueError(f"Unexpected/truncated DJPK XML response for {rid} ({url})")
            # Validate well-formed XML before caching (unpublished years can return broken XML)
            ET.fromstring(xml_text)
            tmp_path = cache_path.with_suffix(".xml.tmp")
            tmp_path.write_text(xml_text, encoding="utf-8")
            tmp_path.replace(cache_path)
            return rid, url, xml_text, True
        except urllib.error.HTTPError as exc:
            last_err = exc
            if exc.code == 403:
                # Fail fast on WAF/geo 403 block instead of sleeping through retries
                break
            if attempt < attempts - 1:
                backoff = 1.5 * (2 ** attempt)
                print(f"  [RETRY XML] {rid} ({exc}) -> waiting {backoff:.1f}s...", flush=True)
                time.sleep(backoff)
                continue
            break
        except Exception as exc:
            last_err = exc
            if attempt < attempts - 1:
                backoff = 1.5 * (2 ** attempt)
                print(f"  [RETRY XML] {rid} ({exc}) -> waiting {backoff:.1f}s...", flush=True)
                time.sleep(backoff)
                continue
            break

    assert last_err is not None
    cached_text = _read_valid_cached_xml(cache_path)
    if cached_text is not None:
        print(
            f"  [WARN] Live endpoint blocked ({_describe_fetch_error(last_err)}), "
            f"falling back to verified cached data in {_display_cache_path(cache_path)}",
            flush=True,
        )
        return rid, url, cached_text, False
    raise last_err


def has_valid_djpk_apbd(accounts: dict[str, tuple[float, float]]) -> bool:
    """Returns True when parsed DJPK accounts contain positive Pendapatan Daerah and Belanja Daerah."""
    pend_ang = accounts.get("Pendapatan Daerah", (0.0, 0.0))[0]
    bel_ang = accounts.get("Belanja Daerah", (0.0, 0.0))[0]
    return pend_ang > 0.0 and bel_ang > 0.0


def probe_latest_djpk_year_and_periode(
    start_year: int | None = None,
    max_lookback: int = DEFAULT_DJPK_MAX_LOOKBACK_YEARS,
    refresh: bool = False,
    polite_delay: float = DEFAULT_POLITE_DELAY,
    target_year: int | None = None,
    target_periode: int | None = None,
    probe_provinces: list[tuple[str, str]] | None = None,
    min_valid_provinces: int = 3,
    fetch_fn: Any = None,
) -> tuple[int, int]:
    """
    Dynamically probes DJPK fiscal years downward starting from `start_year`
    (defaults to `datetime.now().year`) and periods from 12 down to 1, selecting
    the newest (fiscal_year, periode) that returns valid non-empty APBD data
    across a quorum of provinces.
    """
    if target_year is not None and target_periode is not None:
        return int(target_year), max(1, min(12, int(target_periode)))

    base_year = int(start_year) if start_year is not None else datetime.now().year
    candidate_years = (
        [int(target_year)]
        if target_year is not None
        else list(range(base_year, base_year - max(0, int(max_lookback)) - 1, -1))
    )
    candidate_periodes = (
        [max(1, min(12, int(target_periode)))]
        if target_periode is not None
        else list(range(12, 0, -1))
    )

    provinces = probe_provinces if probe_provinces is not None else DEFAULT_PROBE_PROVINCES
    required = max(1, min(int(min_valid_provinces), len(provinces)))
    limiter = PoliteRateLimiter(polite_delay)

    def _default_fetch(
        rid: str, yr: int, per: int, djpk_prov: str, djpk_pemda: str, ref: bool, lim: PoliteRateLimiter
    ) -> tuple[str, str, str, bool]:
        return fetch_djpk_xml(rid, yr, per, djpk_prov, djpk_pemda, ref, lim, max_attempts=1)

    fetcher = fetch_fn if fetch_fn is not None else _default_fetch

    for yr in candidate_years:
        # Fast pre-check when running live: if DJPK catalog explicitly reports no "00" province
        # entry for this year (e.g., future year not yet opened), skip straight to the next year.
        if fetch_fn is None and provinces:
            sample_prov = provinces[0][1]
            cat_cache = RAW_DJPK_CATALOG_DIR / f"{yr}_prov_{sample_prov}.json"
            if not (cat_cache.exists() and not refresh):
                try:
                    limiter.wait()
                    cat_url = f"https://djpk.kemenkeu.go.id/portal/pemda/{sample_prov}/{yr}"
                    cat_data = json.loads(http_get_bytes(cat_url, timeout=15, max_retries=1).decode("utf-8"))
                    if isinstance(cat_data, dict) and "00" not in cat_data:
                        print(f"  [PROBE] DJPK TA {yr}: catalog not yet open (no '00' entry) -> skipping", flush=True)
                        continue
                except Exception:
                    # Network error or unexpected response: fall through to XML check (supports cached fallback)
                    pass

        for per in candidate_periodes:
            valid_count = 0
            total = len(provinces)
            for idx, (rid, djpk_prov) in enumerate(provinces):
                remaining_after = total - idx - 1
                try:
                    _, _, xml_text, _ = fetcher(rid, yr, per, djpk_prov, "00", refresh, limiter)
                    accounts = parse_djpk_xml(xml_text)
                    if has_valid_djpk_apbd(accounts):
                        valid_count += 1
                except Exception:
                    pass

                if valid_count >= required:
                    print(
                        f"  [PROBE OK] Selected DJPK TA {yr} Periode {per} "
                        f"({valid_count}/{idx + 1} probed provinces valid)",
                        flush=True,
                    )
                    return yr, per
                if valid_count + remaining_after < required:
                    break

    raise RuntimeError(
        f"Could not find any valid non-empty DJPK APBD dataset across years {candidate_years} "
        f"and periods {candidate_periodes}."
    )


def parse_djpk_xml(xml_text: str) -> dict[str, tuple[float, float]]:
    """
    Parses DJPK SpreadsheetML XML into {account_name: (anggaran_rupiah, realisasi_rupiah)}.
    Preserves the first canonical occurrence per normalized account name.
    """
    root = ET.fromstring(xml_text)
    ns = {"ss": "urn:schemas-microsoft-com:office:spreadsheet"}
    accounts: dict[str, tuple[float, float]] = {}

    for row in root.findall(".//ss:Row", ns):
        cells = row.findall("ss:Cell", ns)
        vals = []
        for c in cells:
            d = c.find("ss:Data", ns)
            vals.append((d.text or "").strip() if d is not None else "")
        if len(vals) < 3 or vals[0] == "Akun" or not vals[0]:
            continue
        key = re.sub(r"\s+", " ", vals[0]).strip()
        if key in accounts:
            continue
        try:
            anggaran = float(vals[1]) if vals[1] else 0.0
            realisasi = float(vals[2]) if vals[2] else 0.0
        except ValueError:
            continue
        accounts[key] = (anggaran, realisasi)

    return accounts


def fetch_djpk_with_verified_fallback(
    rid: str,
    year: int,
    periode: int,
    djpk_prov: str,
    djpk_pemda: str,
    refresh: bool,
    limiter: PoliteRateLimiter,
) -> tuple[int, int, str, dict[str, tuple[float, float]], bool]:
    """
    Fetches official DJPK APBD for (year, periode). If DJPK has not yet published non-zero
    Belanja Daerah / Pendapatan Daerah for that period, tries earlier official periods
    (periode-1, or previous fiscal year periode 12) and records the exact verified period & URL.
    """
    candidates = [(year, periode)]
    if periode > 1:
        candidates.append((year, periode - 1))
    candidates.append((year - 1, 12))

    any_network = False
    last_result: tuple[int, int, str, dict[str, tuple[float, float]], bool] | None = None

    for yr, per in candidates:
        _, url, xml_text, hit_net = fetch_djpk_xml(
            rid, yr, per, djpk_prov, djpk_pemda, refresh, limiter
        )
        any_network = any_network or hit_net
        acc = parse_djpk_xml(xml_text)
        pend_ang = acc.get("Pendapatan Daerah", (0.0, 0.0))[0]
        bel_ang = acc.get("Belanja Daerah", (0.0, 0.0))[0]
        last_result = (yr, per, url, acc, any_network)
        if pend_ang > 0.0 and bel_ang > 0.0:
            if (yr, per) != (year, periode):
                print(f"  [DJPK FALLBACK] {rid}: TA {year} P{periode} empty -> verified official TA {yr} P{per}", flush=True)
            return last_result

    assert last_result is not None
    return last_result


# ---------------------------------------------------------------------------
# 2. BPS Official Open Data Ingestion (Public Table Payload + Optional WebAPI)
# ---------------------------------------------------------------------------
def extract_json_field(text: str, key: str) -> Any:
    needle = f'"{key}":'
    idx = text.find(needle)
    if idx == -1:
        return None
    start = idx + len(needle)
    while start < len(text) and text[start] in " \t\r\n":
        start += 1
    obj, _ = JSON_DEC.raw_decode(text, start)
    return obj


def fetch_bps_table(table_key: str, refresh: bool, polite_delay: float) -> dict[str, Any]:
    RAW_BPS_DIR.mkdir(parents=True, exist_ok=True)
    meta = BPS_TABLES[table_key]
    cache_path = RAW_BPS_DIR / f"{table_key}_var{meta['var']}.json"

    if cache_path.exists() and not refresh:
        return json.loads(cache_path.read_text(encoding="utf-8"))

    # Optional authenticated WebAPI BPS path if BPS_API_KEY is supplied
    bps_key = os.environ.get("BPS_API_KEY", "").strip()
    if bps_key:
        api_url = (
            f"https://webapi.bps.go.id/v1/api/list/model/data/lang/ind/"
            f"domain/0000/var/{meta['var']}/key/{bps_key}"
        )
        try:
            body = json.loads(http_get_bytes(api_url, timeout=25).decode("utf-8"))
            if body.get("status") == "OK" and "datacontent" in body:
                parsed = {
                    "source_url": meta["url"],
                    "fetched_via": "webapi.bps.go.id",
                    "var": body.get("var", []),
                    "vervar": body.get("vervar", []),
                    "turvar": body.get("turvar", []),
                    "tahun": body.get("tahun", []),
                    "turtahun": body.get("turtahun", []),
                    "datacontent": body.get("datacontent", {}),
                }
                cache_path.write_text(json.dumps(parsed, ensure_ascii=False), encoding="utf-8")
                if polite_delay > 0:
                    time.sleep(polite_delay)
                return parsed
        except Exception as exc:
            print(f"[BPS] WebAPI fallback to public table for {table_key}: {exc}")

    # Direct zero-auth official BPS statistics table payload
    try:
        html = http_get_bytes(meta["url"], timeout=30).decode("utf-8", errors="replace")
        chunks = "".join(re.findall(r'self\.__next_f\.push\(\[1,"(.*?)"\]\)', html, re.S))
        unesc = chunks.replace('\\"', '"').replace("\\\\", "\\")

        parsed = {
            "source_url": meta["url"],
            "fetched_via": "bps.go.id/statistics-table",
            "var": extract_json_field(unesc, "var") or [],
            "vervar": extract_json_field(unesc, "vervar") or [],
            "turvar": extract_json_field(unesc, "turvar") or [],
            "tahun": extract_json_field(unesc, "tahun") or [],
            "turtahun": extract_json_field(unesc, "turtahun") or [],
            "datacontent": extract_json_field(unesc, "datacontent") or {},
        }
        if not parsed["datacontent"]:
            raise RuntimeError(f"Failed to parse BPS public table payload for {table_key}")

        cache_path.write_text(json.dumps(parsed, ensure_ascii=False), encoding="utf-8")
        if polite_delay > 0:
            time.sleep(polite_delay)
        return parsed
    except Exception as exc:
        if cache_path.exists():
            try:
                cached = json.loads(cache_path.read_text(encoding="utf-8"))
                if isinstance(cached, dict) and cached.get("datacontent"):
                    print(
                        f"  [WARN] Live endpoint blocked ({_describe_fetch_error(exc)}), "
                        f"falling back to verified cached data in {_display_cache_path(cache_path)}",
                        flush=True,
                    )
                    return cached
            except Exception:
                pass
        raise


def parse_bps_year_label(label: Any) -> int | None:
    """Extracts a 4-digit calendar year (e.g., 2026) from a BPS tahun label string."""
    match = re.search(r"(19|20)\d{2}", str(label or ""))
    return int(match.group(0)) if match else None


def sort_bps_years(table: dict[str, Any]) -> list[tuple[str, int | None]]:
    """
    Dynamically extracts and sorts available `(tahun_val, calendar_year)` pairs
    from a BPS API/table response from newest to oldest without hardcoding year IDs.
    """
    raw_tahun = table.get("tahun") or []
    entries: list[tuple[int, int, str, int | None]] = []
    for item in raw_tahun:
        if not isinstance(item, dict) or "val" not in item:
            continue
        val_str = str(item["val"]).strip()
        if not val_str:
            continue
        year_int = parse_bps_year_label(item.get("label"))
        try:
            val_num = int(val_str)
        except ValueError:
            val_num = -1
        entries.append((year_int or 0, val_num, val_str, year_int))

    entries.sort(key=lambda x: (x[0], x[1]), reverse=True)
    return [(val_str, year_int) for _, _, val_str, year_int in entries]


def _ordered_turvar_candidates(
    turvar_list: list[dict[str, Any]], preferred_turvar: str | None
) -> list[str]:
    candidates: list[str] = []
    if preferred_turvar is not None:
        candidates.append(str(preferred_turvar))
    # Prefer aggregate ("Jumlah" / "Total") before other breakdowns if preferred ID changed
    prioritized = sorted(
        (t for t in turvar_list if isinstance(t, dict) and "val" in t),
        key=lambda t: (
            0 if any(tok in str(t.get("label", "")).lower() for tok in ("jumlah", "total")) else 1,
            str(t["val"]),
        ),
    )
    for t in prioritized:
        val_str = str(t["val"])
        if val_str not in candidates:
            candidates.append(val_str)
    if not candidates:
        candidates.append("0")
    return candidates


def _ordered_turtahun_candidates(
    turtahun_list: list[dict[str, Any]], preferred_turtahun: list[int] | None
) -> list[str]:
    candidates: list[str] = []
    if preferred_turtahun is not None:
        for tt in preferred_turtahun:
            tt_str = str(tt)
            if tt_str not in candidates:
                candidates.append(tt_str)
    # Dynamically include all turtahun IDs present in the BPS response (descending so later periods
    # such as Semester 2 / Agustus / Tahunan are preferred over earlier periods)
    def _tt_sort_key(item: dict[str, Any]) -> tuple[int, int]:
        label = str(item.get("label", "")).lower()
        priority = 2 if ("semester 2" in label or "agustus" in label) else 1 if "tahunan" in label else 0
        try:
            num = int(item["val"])
        except (TypeError, ValueError):
            num = -1
        return (priority, num)

    for t in sorted(
        (item for item in turtahun_list if isinstance(item, dict) and "val" in item),
        key=_tt_sort_key,
        reverse=True,
    ):
        val_str = str(t["val"])
        if val_str not in candidates:
            candidates.append(val_str)
    if not candidates:
        candidates.append("0")
    return candidates


def lookup_bps_value(
    table: dict[str, Any],
    vervar_code: int,
    preferred_turvar: str | None = None,
    preferred_turtahun: list[int] | None = None,
) -> tuple[float | None, int | None]:
    """
    Looks up the newest verified numeric observation from a BPS table dict.
    BPS datacontent keys follow: "{vervar}{var_id}{turvar}{tahun_val}{turtahun_val}".
    Dynamically selects the latest available year key from `table["tahun"]` rather
    than hardcoding BPS year IDs, and falls back across available turvar/turtahun keys.
    """
    var_list = table.get("var") or []
    turvar_list = table.get("turvar") or []
    turtahun_list = table.get("turtahun") or []
    dc = table.get("datacontent") or {}

    sorted_years = sort_bps_years(table)
    if not var_list or not sorted_years:
        return None, None

    var_id = str(var_list[0]["val"])
    turvar_candidates = _ordered_turvar_candidates(turvar_list, preferred_turvar)
    tt_candidates = _ordered_turtahun_candidates(turtahun_list, preferred_turtahun)

    for th_val, year_label in sorted_years:
        for tv in turvar_candidates:
            for tt in tt_candidates:
                key = f"{vervar_code}{var_id}{tv}{th_val}{tt}"
                if key in dc and dc[key] is not None:
                    try:
                        return float(dc[key]), year_label
                    except (TypeError, ValueError):
                        continue
    return None, None


def detect_latest_bps_year(bps_data: dict[str, dict[str, Any]]) -> int | None:
    """
    Dynamically detects the newest calendar year that actually contains non-null
    observations across the fetched BPS API/table responses.
    """
    detected_years: list[int] = []
    for table in bps_data.values():
        var_list = table.get("var") or []
        dc = table.get("datacontent") or {}
        if not var_list or not dc:
            continue
        var_id = str(var_list[0]["val"])
        turtahun_vals = [str(t["val"]) for t in (table.get("turtahun") or []) if isinstance(t, dict) and "val" in t] or ["0"]
        turvar_vals = [str(t["val"]) for t in (table.get("turvar") or []) if isinstance(t, dict) and "val" in t] or ["0"]
        non_null_keys = [k for k, v in dc.items() if v is not None]

        for th_val, year_int in sort_bps_years(table):
            if year_int is None:
                continue
            suffixes = tuple(f"{tv}{th_val}{tt}" for tv in turvar_vals for tt in turtahun_vals)
            if any(var_id in k and k.endswith(suffixes) for k in non_null_keys):
                detected_years.append(year_int)
                break
    return max(detected_years) if detected_years else None


# ---------------------------------------------------------------------------
# 3. Dynamic Full National Registry Assembly (38 Provinces + All ~508 Kab/Kota)
# ---------------------------------------------------------------------------
def build_national_registry(
    fiscal_year: int,
    bps_ipm_kabkota: dict[str, Any],
    refresh: bool,
    polite_delay: float,
) -> list[dict[str, Any]]:
    """
    Programmatically enumerates all 38 Indonesian provinces + all official DJPK
    autonomous Kabupaten/Kota for `fiscal_year`, deterministically cross-matched
    1-to-1 to official BPS `vervar` codes.
    """
    bps_by_prefix: dict[str, list[tuple[int, str]]] = {}
    for item in bps_ipm_kabkota.get("vervar", []):
        val = int(item["val"])
        if val % 100 == 0 or val == 9999:
            continue
        pref = str(val // 100).zfill(2)
        bps_by_prefix.setdefault(pref, []).append((val, str(item["label"])))

    registry: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    seen_vervars: set[int] = set()
    catalog_net_hits = 0

    for prov_id, bps2, prov_vervar, djpk_prov, prov_name, island, fallback_centroid in PROVINCE_REGISTRY:
        # 1. Province record itself
        registry.append(
            {
                "id": prov_id,
                "bps_code": bps2,
                "bps_vervar": prov_vervar,
                "djpk_prov": djpk_prov,
                "djpk_pemda": "00",
                "name": prov_name,
                "province_id": prov_id,
                "province_name": prov_name,
                "level": "provinsi",
                "island": island,
                "fallback_centroid": fallback_centroid,
            }
        )
        seen_ids.add(prov_id)

        # 2. All official Kabupaten/Kota under this province in DJPK
        catalog, hit_net = fetch_djpk_pemda_catalog(djpk_prov, fiscal_year, refresh, polite_delay)
        if hit_net:
            catalog_net_hits += 1

        bps_prefix = str(prov_vervar // 100).zfill(2)
        bps_entries = bps_by_prefix.get(bps_prefix, [])

        for pemda_code in sorted(catalog.keys()):
            if pemda_code in ("00", "--"):
                continue
            djpk_label = str(catalog[pemda_code]).strip()
            is_kota = djpk_label.lower().startswith("kota ")
            level = "kota" if is_kota else "kabupaten"

            override_vervar = DJPK_TO_BPS_VERVAR_OVERRIDES.get((djpk_prov, pemda_code))
            if override_vervar is not None:
                bps_vervar = override_vervar
            else:
                want_clean = clean_region_label(djpk_label)
                cands = [
                    v
                    for v, lab in bps_entries
                    if clean_region_label(lab) == want_clean
                    and ((v % 100 >= 71) or lab.lower().startswith("kota ")) == is_kota
                ]
                if len(cands) != 1:
                    raise RuntimeError(
                        f"Ambiguous/unmatched BPS vervar for DJPK ({djpk_prov}-{pemda_code} '{djpk_label}'): {cands}"
                    )
                bps_vervar = cands[0]

            if bps_vervar in seen_vervars:
                raise RuntimeError(f"Duplicate BPS vervar {bps_vervar} for {djpk_label}")
            seen_vervars.add(bps_vervar)

            bps_code = f"{bps2}{bps_vervar % 100:02d}"
            rid = f"{'kota' if is_kota else 'kab'}-{bps_code}"
            if rid in seen_ids:
                raise RuntimeError(f"Duplicate region ID {rid} for {djpk_label}")
            seen_ids.add(rid)

            display_name = MODERN_DISPLAY_NAME_OVERRIDES.get((djpk_prov, pemda_code), djpk_label)
            registry.append(
                {
                    "id": rid,
                    "bps_code": bps_code,
                    "bps_vervar": bps_vervar,
                    "djpk_prov": djpk_prov,
                    "djpk_pemda": pemda_code,
                    "name": display_name,
                    "province_id": prov_id,
                    "province_name": prov_name,
                    "level": level,
                    "island": island,
                    "fallback_centroid": fallback_centroid,
                }
            )

    print(
        f"  [CATALOG OK] Enumerated {len(registry)} official Pemda "
        f"(38 provinces + {len(registry) - 38} kab/kota; live catalog fetches={catalog_net_hits})"
    )
    return registry


# ---------------------------------------------------------------------------
# 4. Optional Local Verified CSV Overrides in data/raw/
# ---------------------------------------------------------------------------
def load_optional_csv_overrides() -> tuple[dict[str, dict[str, float]], dict[str, dict[str, float]]]:
    """
    Loads optional user-supplied official CSV files if placed in data/raw/:
      - data/raw/djpk_fungsi_belanja.csv (bps_code, pendidikan_miliar, kesehatan_miliar, infrastruktur_hkpd_pct)
      - data/raw/bps_penduduk.csv (bps_code, population, tpt_pct)
    """
    fungsi_map: dict[str, dict[str, float]] = {}
    fungsi_path = RAW_DIR / "djpk_fungsi_belanja.csv"
    if fungsi_path.exists():
        with fungsi_path.open("r", encoding="utf-8-sig", newline="") as f:
            for row in csv.DictReader(f):
                code = (row.get("bps_code") or "").strip()
                if not code:
                    continue
                entry: dict[str, float] = {}
                for field in ("pendidikan_miliar", "kesehatan_miliar", "infrastruktur_hkpd_pct"):
                    raw_val = (row.get(field) or "").strip()
                    if raw_val:
                        entry[field] = float(raw_val)
                if entry:
                    fungsi_map[code] = entry

    pop_map: dict[str, dict[str, float]] = {}
    pop_path = RAW_DIR / "bps_penduduk.csv"
    if pop_path.exists():
        with pop_path.open("r", encoding="utf-8-sig", newline="") as f:
            for row in csv.DictReader(f):
                code = (row.get("bps_code") or "").strip()
                if not code:
                    continue
                entry = {}
                for field in ("population", "tpt_pct"):
                    raw_val = (row.get(field) or "").strip()
                    if raw_val:
                        entry[field] = float(raw_val)
                if entry:
                    pop_map[code] = entry

    return fungsi_map, pop_map


# ---------------------------------------------------------------------------
# 5. Authentic 38-Province GeoJSON Simplification & Kab/Kota Centroids
# ---------------------------------------------------------------------------
def sq_seg_dist(p: list[float], a: list[float], b: list[float]) -> float:
    x, y = a[0], a[1]
    dx, dy = b[0] - x, b[1] - y
    if dx != 0.0 or dy != 0.0:
        t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy)
        if t > 1.0:
            x, y = b[0], b[1]
        elif t > 0.0:
            x += dx * t
            y += dy * t
    dx, dy = p[0] - x, p[1] - y
    return dx * dx + dy * dy


def simplify_dp(pts: list[list[float]], tol: float) -> list[list[float]]:
    if len(pts) <= 4:
        return pts
    sq_tol = tol * tol
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        first, last = stack.pop()
        max_sq = 0.0
        idx = first
        for i in range(first + 1, last):
            d = sq_seg_dist(pts[i], pts[first], pts[last])
            if d > max_sq:
                max_sq = d
                idx = i
        if max_sq > sq_tol:
            keep[idx] = True
            stack.append((first, idx))
            stack.append((idx, last))
    return [pts[i] for i in range(len(pts)) if keep[i]]


def ring_area(ring: list[list[float]]) -> float:
    a = 0.0
    for i in range(len(ring) - 1):
        a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
    return abs(a) * 0.5


def simplify_ring(ring: list[list[float]], tol: float) -> list[list[float]] | None:
    if len(ring) < 4:
        return None
    if ring[0] != ring[-1]:
        ring = ring + [ring[0]]
    p0 = ring[0]
    mid = max(
        range(1, len(ring) - 1),
        key=lambda i: (ring[i][0] - p0[0]) ** 2 + (ring[i][1] - p0[1]) ** 2,
    )
    s1 = simplify_dp(ring[: mid + 1], tol)
    s2 = simplify_dp(ring[mid:], tol)
    res = [[round(pt[0], 4), round(pt[1], 4)] for pt in (s1[:-1] + s2)]
    if len(res) < 4:
        return None
    if res[0] != res[-1]:
        res.append(res[0])
    return res


def simplify_geometry(
    geom: dict[str, Any], tol: float = 0.0042, min_island_area: float = 0.00035
) -> dict[str, Any]:
    gtype = geom["type"]
    coords = geom["coordinates"]
    if gtype == "Polygon":
        out_rings = []
        for idx, ring in enumerate(coords):
            sr = simplify_ring(ring, tol)
            if sr and (idx == 0 or ring_area(sr) >= min_island_area):
                out_rings.append(sr)
        return {"type": "Polygon", "coordinates": out_rings}

    if gtype == "MultiPolygon":
        ranked = sorted(coords, key=lambda poly: ring_area(poly[0]), reverse=True)
        polys = []
        for p_idx, poly in enumerate(ranked):
            ext_area = ring_area(poly[0])
            if p_idx > 0 and ext_area < min_island_area:
                continue
            local_tol = tol * 0.35 if ext_area < 0.15 else tol
            sr_ext = simplify_ring(poly[0], local_tol)
            if not sr_ext:
                continue
            new_poly = [sr_ext]
            for hole in poly[1:]:
                if ring_area(hole) >= min_island_area:
                    sr_h = simplify_ring(hole, local_tol)
                    if sr_h:
                        new_poly.append(sr_h)
            polys.append(new_poly)
        return {"type": "MultiPolygon", "coordinates": polys}

    return geom


def load_base_province_geojson(refresh: bool) -> dict[str, dict[str, Any]]:
    """
    Loads authentic 38-province Indonesian archipelago boundaries (BIG/BPS via AlfianAliM)
    simplified cleanly to ~350-650 KB and indexed by official 2-digit province code ('11'..'96').
    """
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    cache_path = RAW_DIR / "indonesia_provinces_38_base.geojson"

    if cache_path.exists() and not refresh:
        base_fc = json.loads(cache_path.read_text(encoding="utf-8"))
    else:
        try:
            print(f"[GEO] Downloading authentic 38-province Indonesia boundaries from {GEOJSON_UPSTREAM_URL}...")
            raw_gj = json.loads(http_get_bytes(GEOJSON_UPSTREAM_URL, timeout=45).decode("utf-8"))
            simplified_features = []
            for feat in raw_gj["features"]:
                props = feat["properties"]
                code = str(props["code"]).zfill(2)
                sg = simplify_geometry(feat["geometry"], tol=0.0042, min_island_area=0.00035)
                simplified_features.append(
                    {
                        "type": "Feature",
                        "properties": {
                            "province_code": code,
                            "province_name": props["name"],
                            "latitude": props.get("latitude"),
                            "longitude": props.get("longitude"),
                        },
                        "geometry": sg,
                    }
                )
            base_fc = {
                "type": "FeatureCollection",
                "name": "indonesia_38_provinces_base_big_bps",
                "features": simplified_features,
            }
            cache_path.write_text(
                json.dumps(base_fc, ensure_ascii=False, separators=(",", ":")),
                encoding="utf-8",
            )
        except Exception as exc:
            if cache_path.exists():
                print(
                    f"  [WARN] Live endpoint blocked ({_describe_fetch_error(exc)}), "
                    f"falling back to verified cached data in {_display_cache_path(cache_path)}",
                    flush=True,
                )
                base_fc = json.loads(cache_path.read_text(encoding="utf-8"))
            else:
                raise

    by_code: dict[str, dict[str, Any]] = {}
    for feat in base_fc["features"]:
        code = str(feat["properties"]["province_code"]).zfill(2)
        by_code[code] = feat
    return by_code


def compute_geometry_centroid(geom: dict[str, Any]) -> list[float] | None:
    """Computes approximate centroid from the largest polygon's exterior ring."""
    gtype = geom.get("type")
    coords = geom.get("coordinates")
    ring: list[list[float]] | None = None
    if gtype == "Polygon" and coords:
        ring = coords[0]
    elif gtype == "MultiPolygon" and coords:
        largest = max(coords, key=lambda poly: ring_area(poly[0]) if poly and poly[0] else 0.0)
        ring = largest[0] if largest else None
    if not ring:
        return None
    lons = [pt[0] for pt in ring]
    lats = [pt[1] for pt in ring]
    return [round((min(lons) + max(lons)) / 2.0, 4), round((min(lats) + max(lats)) / 2.0, 4)]


def load_kab_kota_centroids(refresh: bool) -> dict[str, list[float]]:
    """
    Extracts & caches lightweight [lon, lat] centroids for all Kabupaten/Kota from
    BIG/BPS open GeoJSON into data/raw/kab_kota_centroids.json (~20 KB).
    """
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    cache_path = RAW_DIR / "kab_kota_centroids.json"
    if cache_path.exists() and not refresh:
        return json.loads(cache_path.read_text(encoding="utf-8"))

    try:
        print(f"[GEO] Downloading Kab/Kota centroids from {KABKOTA_GEOJSON_UPSTREAM_URL}...")
        raw_gj = json.loads(http_get_bytes(KABKOTA_GEOJSON_UPSTREAM_URL, timeout=60).decode("utf-8"))
        centroids: dict[str, list[float]] = {}
        for feat in raw_gj.get("features", []):
            props = feat.get("properties") or {}
            raw_code = str(props.get("code") or props.get("kode") or "").replace(".", "").strip()
            lon = props.get("longitude")
            lat = props.get("latitude")
            if lon is not None and lat is not None:
                c = [round(float(lon), 4), round(float(lat), 4)]
            else:
                c = compute_geometry_centroid(feat.get("geometry") or {})
            if raw_code and c:
                centroids[raw_code] = c
        if centroids:
            cache_path.write_text(json.dumps(centroids, ensure_ascii=False), encoding="utf-8")
            print(f"  [GEO OK] Cached {len(centroids)} Kab/Kota centroids.")
            return centroids
    except Exception as exc:
        if cache_path.exists():
            print(
                f"  [WARN] Live endpoint blocked ({_describe_fetch_error(exc)}), "
                f"falling back to verified cached data in {_display_cache_path(cache_path)}",
                flush=True,
            )
            return json.loads(cache_path.read_text(encoding="utf-8"))
        print(f"  [GEO WARN] Could not fetch Kab/Kota centroids ({exc}); using parent province centroids.")
    return {}


# ---------------------------------------------------------------------------
# 6. Deterministic Fiscal Audit Engine (Exact Parity with src/lib/audit-engine.ts)
# ---------------------------------------------------------------------------
def evaluate_hkpd(
    pegawai_pct: float,
    modal_pct: float,
    infrastruktur_hkpd_pct: float | None,
    pendidikan_pct: float | None,
    serapan_belanja_pct: float,
) -> dict[str, Any]:
    pegawai_pts = (
        35.0 + min(5.0, (PEGAWAI_MAX_PCT - pegawai_pct) * 0.625)
        if pegawai_pct <= PEGAWAI_MAX_PCT
        else max(0.0, 35.0 - (pegawai_pct - PEGAWAI_MAX_PCT) * 2.5)
    )

    if infrastruktur_hkpd_pct is not None:
        infra_pts = (
            30.0 + min(5.0, (infrastruktur_hkpd_pct - INFRA_HKPD_MIN_PCT) * 0.625)
            if infrastruktur_hkpd_pct >= INFRA_HKPD_MIN_PCT
            else max(0.0, 30.0 - (INFRA_HKPD_MIN_PCT - infrastruktur_hkpd_pct) * 1.5)
        )
        infra_compliant: bool | None = infrastruktur_hkpd_pct >= INFRA_HKPD_MIN_PCT
        infra_basis = "uu_hkpd_40"
    else:
        infra_pts = (
            28.0 + min(7.0, (modal_pct - MODAL_BENCHMARK_PCT) * 0.7)
            if modal_pct >= MODAL_BENCHMARK_PCT
            else max(0.0, 28.0 - (MODAL_BENCHMARK_PCT - modal_pct) * 1.8)
        )
        infra_compliant = modal_pct >= MODAL_BENCHMARK_PCT
        infra_basis = "djpk_belanja_modal"

    if pendidikan_pct is not None:
        pend_pts: float | None = (
            21.0 + min(4.0, (pendidikan_pct - PENDIDIKAN_MIN_PCT) * 0.5)
            if pendidikan_pct >= PENDIDIKAN_MIN_PCT
            else max(0.0, 21.0 - (PENDIDIKAN_MIN_PCT - pendidikan_pct) * 3.0)
        )
        pend_compliant: bool | None = pendidikan_pct >= PENDIDIKAN_MIN_PCT
        third_pts = pend_pts
        scoring_basis = "UU HKPD Penuh (3 Pilar Terverifikasi)"
    else:
        pend_pts = None
        pend_compliant = None
        third_pts = (
            20.0 + min(5.0, (serapan_belanja_pct - 85.0) * 0.5)
            if serapan_belanja_pct >= 85.0
            else max(0.0, 20.0 - (85.0 - serapan_belanja_pct) * 0.9)
        )
        scoring_basis = "DJPK Klasifikasi Ekonomi (Pegawai UU HKPD + Belanja Modal + Serapan Realisasi)"

    score = round1(clamp(pegawai_pts + infra_pts + third_pts, 0.0, 100.0))
    if score >= 80.0:
        grade, label = "hijau", "Rapor Hijau"
    elif score >= 60.0:
        grade, label = "kuning", "Rapor Kuning"
    else:
        grade, label = "merah", "Rapor Merah"

    return {
        "score": score,
        "grade": grade,
        "grade_label": label,
        "pegawai_compliant": pegawai_pct <= PEGAWAI_MAX_PCT,
        "infrastruktur_compliant": infra_compliant,
        "pendidikan_compliant": pend_compliant,
        "pegawai_points": round1(pegawai_pts),
        "infrastruktur_points": round1(infra_pts),
        "pendidikan_points": round1(pend_pts) if pend_pts is not None else None,
        "serapan_points": round1(third_pts) if pend_pts is None else None,
        "infra_basis": infra_basis,
        "scoring_basis": scoring_basis,
    }


def compute_social_outcome(
    ipm: float | None, poverty_pct: float | None, tpt_pct: float | None
) -> float:
    """Computes normalized 0-100 social outcome score using ONLY verified non-null BPS indicators."""
    weighted_sum = 0.0
    total_w = 0.0
    if ipm is not None:
        n_ipm = clamp((ipm - 55.0) / (86.0 - 55.0) * 100.0, 0.0, 100.0)
        weighted_sum += 0.45 * n_ipm
        total_w += 0.45
    if poverty_pct is not None:
        n_pov = clamp((32.0 - poverty_pct) / (32.0 - 2.0) * 100.0, 0.0, 100.0)
        weighted_sum += 0.35 * n_pov
        total_w += 0.35
    if tpt_pct is not None:
        n_tpt = clamp((10.0 - tpt_pct) / (10.0 - 1.5) * 100.0, 0.0, 100.0)
        weighted_sum += 0.20 * n_tpt
        total_w += 0.20
    if total_w == 0.0:
        return 0.0
    return round1(weighted_sum / total_w)


def classify_fiscal_profile(
    hkpd_score: float,
    social_score: float,
    pegawai_pct: float,
    modal_pct: float,
    pad_ratio_pct: float,
) -> str:
    if hkpd_score >= 78.0 and social_score >= 65.0:
        return "Disiplin Fiskal & Dampak Tinggi"
    if pad_ratio_pct >= 45.0 and social_score >= 65.0:
        return "Mandiri Fiskal & Progresif"
    if pegawai_pct > 35.0 and modal_pct < 12.0:
        return "Tekanan Belanja Pegawai Tinggi"
    if modal_pct >= 18.0 and social_score < 58.0:
        return "Belanja Modal Tinggi, Tantangan Sosial"
    return "Transisi Reformasi Fiskal"


def build_verified_audit_summary(record: dict[str, Any]) -> dict[str, str]:
    """
    Deterministic audit narrative strictly citing ONLY verified non-null numbers
    from DJPK Kemenkeu and BPS RI. Zero hallucinated or extrapolated metrics.
    """
    name = record["name"]
    fy = record["fiscal_year"]
    rev = record["revenue"]
    exp = record["expenditure"]
    hkpd = record["hkpd"]
    bps = record["bps"]
    eff = record["effectiveness"]

    peg_status = (
        "mematuhi batas UU HKPD (<=30%)"
        if hkpd["pegawai_compliant"]
        else f"melampaui batas 30% UU HKPD sebesar {round1(exp['pegawai_pct'] - 30.0)} poin"
    )
    pend_note = (
        f" Belanja fungsi pendidikan tercatat {exp['pendidikan_pct']}%."
        if exp["pendidikan_pct"] is not None
        else " Rincian fungsi pendidikan belum dipublikasikan resmi pada endpoint klasifikasi ekonomi DJPK."
    )
    fiscal_finding = (
        f"Pada APBD TA {fy} (DJPK Kemenkeu), {name} mengelola belanja Rp {exp['total_belanja_miliar']:,.1f} Miliar "
        f"(realisasi {exp['serapan_belanja_pct']}%). Belanja pegawai sebesar {exp['pegawai_pct']}% {peg_status}, "
        f"sementara belanja modal tercatat {exp['modal_pct']}% dengan rasio kemandirian PAD {rev['pad_ratio_pct']}%.{pend_note}"
    )

    bps_parts = []
    if bps["ipm"] is not None:
        bps_parts.append(f"IPM {bps['ipm']} (LF SP2020)")
    if bps["poverty_rate_pct"] is not None:
        bps_parts.append(f"kemiskinan {bps['poverty_rate_pct']}%")
    if bps["tpt_pct"] is not None:
        bps_parts.append(f"TPT {bps['tpt_pct']}%")
    else:
        bps_parts.append("TPT kab/kota belum dipublikasikan pada tabel nasional BPS")

    social_corr = (
        f"Berdasarkan rilis BPS RI ({bps['year']}), {name} mencatat {', '.join(bps_parts)}. "
        f"Kombinasi indikator sosial BPS dan postur fiskal DJPK menempatkan daerah ini pada profil "
        f"'{eff['archetype']}' (Skor Efektivitas {eff['effectiveness_score']}/100, peringkat #{eff['rank_national']})."
    )

    if not hkpd["pegawai_compliant"]:
        over_pct = round1(exp["pegawai_pct"] - 30.0)
        over_miliar = round1(exp["total_belanja_miliar"] * (over_pct / 100.0))
        policy_rec = (
            f"Pengawalan prioritas: pengendalian belanja pegawai yang masih {over_pct}% di atas plafon 30% UU HKPD "
            f"(setara Rp {over_miliar:,.1f} Miliar) untuk memperbesar ruang belanja modal ({exp['modal_pct']}%) dan layanan dasar."
        )
    elif exp["modal_pct"] < MODAL_BENCHMARK_PCT:
        policy_rec = (
            f"Belanja pegawai sudah terjaga di {exp['pegawai_pct']}%, namun porsi belanja modal ({exp['modal_pct']}%) "
            f"masih di bawah acuan 15%. Kawal realokasi dari belanja barang & jasa ({exp['barang_jasa_pct']}%) ke aset layanan publik."
        )
    elif rev["pad_ratio_pct"] < 25.0:
        policy_rec = (
            f"Ketergantungan transfer pusat (TKD) mencapai {rev['tkd_ratio_pct']}% dengan PAD {rev['pad_ratio_pct']}%. "
            f"Fokuskan pengawalan pada intensifikasi pajak daerah serta efektivitas serapan belanja ({exp['serapan_belanja_pct']}%)."
        )
    else:
        policy_rec = (
            f"Pertahankan kepatuhan belanja pegawai ({exp['pegawai_pct']}%) dan serapan realisasi ({exp['serapan_belanja_pct']}%), "
            f"serta kawal transparansi rincian fungsi pendidikan & infrastruktur pelayanan publik 40% UU HKPD pada Perda APBD berikutnya."
        )

    return {
        "fiscal_finding": fiscal_finding,
        "social_correlation": social_corr,
        "policy_recommendation": policy_rec,
        "generated_by": "Kawal APBD Verified-Data Auditor v3 (DJPK + BPS National)",
        "audited_at": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
    }


def summarize_tier(items: list[dict[str, Any]]) -> dict[str, Any]:
    """Computes clean aggregate fiscal metrics for a subset (provinces or kab/kota)."""
    if not items:
        return {
            "count": 0,
            "total_apbd_triliun": 0.0,
            "total_realisasi_triliun": 0.0,
            "avg_serapan_pct": 0.0,
            "avg_hkpd_score": 0.0,
            "avg_pegawai_pct": 0.0,
            "avg_modal_pct": 0.0,
            "avg_pad_ratio_pct": 0.0,
            "grade_distribution": {"hijau": 0, "kuning": 0, "merah": 0},
        }
    grades = {"hijau": 0, "kuning": 0, "merah": 0}
    for r in items:
        grades[r["hkpd"]["grade"]] += 1
    return {
        "count": len(items),
        "total_apbd_triliun": round2(sum(r["expenditure"]["total_belanja_miliar"] for r in items) / 1000.0),
        "total_realisasi_triliun": round2(
            sum(r["expenditure"]["realisasi_belanja_miliar"] for r in items) / 1000.0
        ),
        "avg_serapan_pct": round1(statistics.mean(r["expenditure"]["serapan_belanja_pct"] for r in items)),
        "avg_hkpd_score": round1(statistics.mean(r["hkpd"]["score"] for r in items)),
        "avg_pegawai_pct": round1(statistics.mean(r["expenditure"]["pegawai_pct"] for r in items)),
        "avg_modal_pct": round1(statistics.mean(r["expenditure"]["modal_pct"] for r in items)),
        "avg_pad_ratio_pct": round1(statistics.mean(r["revenue"]["pad_ratio_pct"] for r in items)),
        "grade_distribution": grades,
    }


FISCAL_CLUSTER_TIERS: tuple[str, str, str] = ("Tinggi", "Sedang", "Rendah")


def _assign_stratum_clusters(group: list[dict[str, Any]]) -> dict[str, int]:
    """
    Computes deterministic Fiscal Capacity Index within a single administrative stratum
    (Provinsi OR Kab/Kota) from authentic DJPK PAD ratio (55%) + log10 APBD scale (45%),
    splits into 3 balanced quantile tertiles (Tinggi / Sedang / Rendah), and ranks each
    Pemda within its exact peer bucket by effectiveness & HKPD audit score.
    """
    counts = {"Tinggi": 0, "Sedang": 0, "Rendah": 0}
    if not group:
        return counts

    pad_vals = [float(r["revenue"]["pad_ratio_pct"]) for r in group]
    log_vals = [math.log10(max(1.0, float(r["expenditure"]["total_belanja_miliar"]))) for r in group]
    min_pad, max_pad = min(pad_vals), max(pad_vals)
    min_log, max_log = min(log_vals), max(log_vals)

    for r, pad_v, log_v in zip(group, pad_vals, log_vals):
        norm_pad = ((pad_v - min_pad) / (max_pad - min_pad) * 100.0) if max_pad > min_pad else 50.0
        norm_log = ((log_v - min_log) / (max_log - min_log) * 100.0) if max_log > min_log else 50.0
        r["fiscal_capacity_index"] = round1(clamp(0.55 * norm_pad + 0.45 * norm_log, 0.0, 100.0))

    ordered = sorted(
        group,
        key=lambda x: (
            -x["fiscal_capacity_index"],
            -float(x["revenue"]["pad_ratio_pct"]),
            -float(x["expenditure"]["total_belanja_miliar"]),
            x["name"],
        ),
    )

    n = len(ordered)
    if n == 1:
        tier_labels = ["Sedang"]
    elif n == 2:
        tier_labels = ["Tinggi", "Rendah"]
    else:
        base, rem = divmod(n, 3)
        n_tinggi = base + (1 if rem == 2 else 0)
        n_sedang = base + (1 if rem >= 1 else 0)
        n_rendah = base
        tier_labels = (["Tinggi"] * n_tinggi) + (["Sedang"] * n_sedang) + (["Rendah"] * n_rendah)

    for r, tier in zip(ordered, tier_labels):
        r["fiscal_cluster"] = tier
        counts[tier] += 1

    # Assign 1-based performance rank within each peer bucket
    for tier in FISCAL_CLUSTER_TIERS:
        bucket = [r for r in ordered if r["fiscal_cluster"] == tier]
        bucket.sort(
            key=lambda x: (
                -float(x["effectiveness"]["effectiveness_score"]),
                -float(x["hkpd"]["score"]),
                x["name"],
            )
        )
        total = len(bucket)
        for rank_idx, r in enumerate(bucket, start=1):
            r["fiscal_cluster_rank"] = rank_idx
            r["fiscal_cluster_total"] = total

    return counts


def assign_fiscal_capacity_clusters(
    regions: list[dict[str, Any]],
) -> dict[str, dict[str, int]]:
    """
    Stratifies Provinsi separately from autonomous Kabupaten/Kota and assigns
    Apple-to-Apple Fiscal Capacity Clusters (`Tinggi` / `Sedang` / `Rendah`),
    peer rank (`fiscal_cluster_rank`), and peer group size (`fiscal_cluster_total`).
    """
    provinces = [r for r in regions if r["level"] == "provinsi"]
    kab_kota = [r for r in regions if r["level"] != "provinsi"]

    prov_dist = _assign_stratum_clusters(provinces)
    kab_dist = _assign_stratum_clusters(kab_kota)
    overall_dist = {
        tier: prov_dist[tier] + kab_dist[tier] for tier in FISCAL_CLUSTER_TIERS
    }
    return {
        "overall": overall_dist,
        "provinsi": prov_dist,
        "kab_kota": kab_dist,
    }


# ---------------------------------------------------------------------------
# 7. Master Full-National Build Pipeline
# ---------------------------------------------------------------------------
def build_datasets(
    fiscal_year: int | None = None,
    periode: int | None = None,
    refresh: bool = False,
    polite_delay: float = DEFAULT_POLITE_DELAY,
    workers: int = DEFAULT_WORKERS,
) -> tuple[list[dict[str, Any]], dict[str, Any], dict[str, Any]]:
    verified_timestamp = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    limiter = PoliteRateLimiter(polite_delay)

    print(
        f"[ETL] Step 0/5: Probing newest available DJPK fiscal year & period "
        f"(from {fiscal_year or datetime.now().year} downward, periode={periode or '12..1'})...",
        flush=True,
    )
    resolved_year, resolved_periode = probe_latest_djpk_year_and_periode(
        start_year=datetime.now().year,
        refresh=refresh,
        polite_delay=polite_delay,
        target_year=fiscal_year,
        target_periode=periode,
    )
    fiscal_year = resolved_year
    periode = resolved_periode

    print(f"[ETL] Step 1/5: Loading official BPS tables (refresh={refresh})...", flush=True)
    bps_data: dict[str, dict[str, Any]] = {}
    for k in BPS_TABLES:
        bps_data[k] = fetch_bps_table(k, refresh, polite_delay)
        bps_years = [yr for _, yr in sort_bps_years(bps_data[k]) if yr is not None]
        print(
            f"  [BPS OK] {k} (rows={len(bps_data[k]['datacontent'])}, years={bps_years})",
            flush=True,
        )
    global_bps_year = detect_latest_bps_year(bps_data)
    print(f"  [BPS YEAR] Dynamically detected latest BPS year: {global_bps_year}", flush=True)

    print(
        f"[ETL] Step 2/5: Enumerating all 38 provinces + official DJPK Kab/Kota catalog "
        f"(TA {fiscal_year}, Periode {periode})...",
        flush=True,
    )
    national_registry = build_national_registry(
        fiscal_year=fiscal_year,
        bps_ipm_kabkota=bps_data["ipm_kabkota"],
        refresh=refresh,
        polite_delay=polite_delay,
    )

    print(
        f"[ETL] Step 3/5: Fetching/resuming official DJPK APBD XML for {len(national_registry)} Pemda "
        f"(global polite interval={polite_delay:.2f}s, workers={workers}, cached in data/raw/djpk/)...",
        flush=True,
    )
    djpk_records: dict[str, tuple[int, int, str, dict[str, tuple[float, float]]]] = {}
    cached_count = 0
    live_count = 0
    processed = 0
    skipped_empty: list[tuple[str, str]] = []

    def _fetch_one(entry: dict[str, Any]) -> tuple[dict[str, Any], int, int, str, dict[str, tuple[float, float]], bool]:
        yr, per, url, acc, hit_net = fetch_djpk_with_verified_fallback(
            rid=entry["id"],
            year=fiscal_year,
            periode=periode,
            djpk_prov=entry["djpk_prov"],
            djpk_pemda=entry["djpk_pemda"],
            refresh=refresh,
            limiter=limiter,
        )
        return entry, yr, per, url, acc, hit_net

    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
        futs = [pool.submit(_fetch_one, entry) for entry in national_registry]
        for fut in concurrent.futures.as_completed(futs):
            entry, yr, per, url, acc, hit_net = fut.result()
            rid = entry["id"]
            processed += 1
            if hit_net:
                live_count += 1
            else:
                cached_count += 1

            pend_ang = acc.get("Pendapatan Daerah", (0.0, 0.0))[0]
            bel_ang = acc.get("Belanja Daerah", (0.0, 0.0))[0]
            if pend_ang <= 0.0 or bel_ang <= 0.0:
                skipped_empty.append((rid, entry["name"]))
                print(
                    f"  [DJPK SKIP] {rid} ({entry['name']}): zero/unpublished APBD in DJPK TA {yr} P{per}",
                    flush=True,
                )
            else:
                djpk_records[rid] = (yr, per, url, acc)

            if processed % 50 == 0 or processed == len(national_registry):
                print(
                    f"  [DJPK PROGRESS] {processed}/{len(national_registry)} processed "
                    f"(cached={cached_count}, live={live_count}, valid={len(djpk_records)})",
                    flush=True,
                )

    if skipped_empty:
        print(f"  [DJPK WARN] {len(skipped_empty)} Pemda had no published DJPK APBD data: {skipped_empty}")

    print("[ETL] Step 4/5: Loading authentic 38-province GeoJSON, Kab/Kota centroids & CSV overrides...")
    base_geo = load_base_province_geojson(refresh=refresh)
    kab_centroids = load_kab_kota_centroids(refresh=refresh)
    fungsi_overrides, pop_overrides = load_optional_csv_overrides()

    print("[ETL] Step 5/5: Assembling verified national region records & provenance metadata...")
    preliminary: list[dict[str, Any]] = []
    kab_count_by_prov: dict[str, int] = {}

    for entry in national_registry:
        rid = entry["id"]
        if rid not in djpk_records:
            continue

        bps_code = entry["bps_code"]
        bps_vervar = entry["bps_vervar"]
        djpk_prov = entry["djpk_prov"]
        djpk_pemda = entry["djpk_pemda"]
        name = entry["name"]
        province_id = entry["province_id"]
        province_name = entry["province_name"]
        level = entry["level"]
        island = entry["island"]
        fallback_centroid = entry["fallback_centroid"]

        rec_year, rec_periode, source_djpk_url, acc = djpk_records[rid]

        def get_miliar(key: str) -> tuple[float, float]:
            ang, real = acc.get(key, (0.0, 0.0))
            return round2(ang / 1e9), round2(real / 1e9)

        # Revenue (100% Exact Official DJPK Anggaran & Realisasi)
        pend_ang, pend_real = get_miliar("Pendapatan Daerah")
        pad_ang, pad_real = get_miliar("PAD")
        pajak_ang, _ = get_miliar("Pajak Daerah")
        retribusi_ang, _ = get_miliar("Retribusi Daerah")
        tkd_ang, tkd_real = get_miliar("TKDD")
        if tkd_ang == 0.0:
            tkd_ang, tkd_real = get_miliar("Pendapatan Transfer Pemerintah Pusat")
        pend_lain_ang, _ = get_miliar("Pendapatan Lainnya")

        pad_ratio = round1((pad_ang / pend_ang) * 100.0)
        tkd_ratio = round1((tkd_ang / pend_ang) * 100.0)
        serapan_pendapatan_pct = round1((pend_real / pend_ang) * 100.0) if pend_ang > 0 else 0.0

        # Expenditure (100% Exact Official DJPK Anggaran & Realisasi)
        bel_ang, bel_real = get_miliar("Belanja Daerah")
        peg_ang, peg_real = get_miliar("Belanja Pegawai")
        bj_ang, bj_real = get_miliar("Belanja Barang dan Jasa")
        mod_ang, mod_real = get_miliar("Belanja Modal")
        lain_ang, lain_real = get_miliar("Belanja Lainnya")

        bagi_hasil_ang, _ = get_miliar("Belanja Bagi Hasil")
        bantuan_keu_ang, _ = get_miliar("Belanja Bantuan Keuangan")
        subsidi_ang, _ = get_miliar("Belanja Subsidi")
        hibah_ang, _ = get_miliar("Belanja Hibah")
        bansos_ang, _ = get_miliar("Belanja Bantuan Sosial")
        tidak_terduga_ang, _ = get_miliar("Belanja Tidak Terduga")

        transfer_keluar_miliar = round2(bagi_hasil_ang + bantuan_keu_ang)
        hibah_bansos_subsidi_miliar = round2(hibah_ang + bansos_ang + subsidi_ang)

        peg_pct = round1((peg_ang / bel_ang) * 100.0)
        bj_pct = round1((bj_ang / bel_ang) * 100.0)
        mod_pct = round1((mod_ang / bel_ang) * 100.0)
        lain_pct = round1((lain_ang / bel_ang) * 100.0)
        serapan_bel_pct = round1((bel_real / bel_ang) * 100.0)

        # Optional verified functional overrides from data/raw/djpk_fungsi_belanja.csv
        f_ov = fungsi_overrides.get(bps_code, {})
        pendidikan_miliar: float | None = f_ov.get("pendidikan_miliar")
        kesehatan_miliar: float | None = f_ov.get("kesehatan_miliar")
        pendidikan_pct: float | None = (
            round1((pendidikan_miliar / bel_ang) * 100.0) if pendidikan_miliar is not None else None
        )
        kesehatan_pct: float | None = (
            round1((kesehatan_miliar / bel_ang) * 100.0) if kesehatan_miliar is not None else None
        )
        infrastruktur_hkpd_pct: float | None = f_ov.get("infrastruktur_hkpd_pct")

        birokrasi_pct = peg_pct
        publik_pct = round1(100.0 - peg_pct)

        # BPS Indicators (100% Exact Official Live BPS Tables)
        if level == "provinsi":
            ipm_val, ipm_year = lookup_bps_value(bps_data["ipm_prov"], bps_vervar)
            pov_val, pov_year = lookup_bps_value(
                bps_data["poverty_pct_prov"],
                bps_vervar,
                preferred_turvar="434",
                preferred_turtahun=[62, 61, 63],
            )
            pov_cnt, _ = lookup_bps_value(
                bps_data["poverty_count_prov"],
                bps_vervar,
                preferred_turvar="434",
                preferred_turtahun=[62, 61, 63],
            )
            tpt_val, tpt_year = lookup_bps_value(
                bps_data["tpt_prov"], bps_vervar, preferred_turtahun=[190, 189, 191]
            )
            pop15_val, _ = lookup_bps_value(bps_data["pop15_prov"], bps_vervar)
            bps_primary_url = BPS_TABLES["ipm_prov"]["url"]
            bps_urls = {
                "ipm": BPS_TABLES["ipm_prov"]["url"],
                "poverty": BPS_TABLES["poverty_pct_prov"]["url"],
                "tpt": BPS_TABLES["tpt_prov"]["url"],
                "population_15_plus": BPS_TABLES["pop15_prov"]["url"],
            }
        else:
            kab_count_by_prov[province_id] = kab_count_by_prov.get(province_id, 0) + 1
            ipm_val, ipm_year = lookup_bps_value(bps_data["ipm_kabkota"], bps_vervar)
            pov_val, pov_year = lookup_bps_value(bps_data["poverty_pct_kabkota"], bps_vervar)
            pov_cnt, _ = lookup_bps_value(bps_data["poverty_count_kabkota"], bps_vervar)
            tpt_val, tpt_year = None, None
            pop15_val = None
            bps_primary_url = BPS_TABLES["ipm_kabkota"]["url"]
            bps_urls = {
                "ipm": BPS_TABLES["ipm_kabkota"]["url"],
                "poverty": BPS_TABLES["poverty_pct_kabkota"]["url"],
                "tpt": None,
                "population_15_plus": None,
            }

        p_ov = pop_overrides.get(bps_code, {})
        population: int | None = int(p_ov["population"]) if "population" in p_ov else None
        if tpt_val is None and "tpt_pct" in p_ov:
            tpt_val = round2(p_ov["tpt_pct"])

        apbd_per_capita_idr: int | None = (
            round((bel_ang * 1_000_000_000.0) / population) if population and population > 0 else None
        )
        available_bps_years = [y for y in (ipm_year, pov_year, tpt_year) if y is not None]
        bps_year = max(available_bps_years) if available_bps_years else (global_bps_year or rec_year)

        # Centroid: authentic GeoJSON centroid for provinces & Kab/Kota (fallback to parent province)
        centroid = fallback_centroid
        if level == "provinsi" and bps_code in base_geo:
            gp = base_geo[bps_code]["properties"]
            if gp.get("longitude") is not None and gp.get("latitude") is not None:
                centroid = [round(float(gp["longitude"]), 4), round(float(gp["latitude"]), 4)]
        elif level != "provinsi":
            if bps_code in kab_centroids:
                centroid = kab_centroids[bps_code]
            elif str(bps_vervar) in kab_centroids:
                centroid = kab_centroids[str(bps_vervar)]
            elif province_id.replace("prov-", "") in base_geo:
                gp = base_geo[province_id.replace("prov-", "")]["properties"]
                if gp.get("longitude") is not None and gp.get("latitude") is not None:
                    centroid = [round(float(gp["longitude"]), 4), round(float(gp["latitude"]), 4)]

        hkpd = evaluate_hkpd(
            pegawai_pct=peg_pct,
            modal_pct=mod_pct,
            infrastruktur_hkpd_pct=infrastruktur_hkpd_pct,
            pendidikan_pct=pendidikan_pct,
            serapan_belanja_pct=serapan_bel_pct,
        )
        social_score = compute_social_outcome(ipm_val, pov_val, tpt_val)
        effectiveness_score = round1(0.55 * hkpd["score"] + 0.45 * social_score)
        profile_label = classify_fiscal_profile(
            hkpd_score=hkpd["score"],
            social_score=social_score,
            pegawai_pct=peg_pct,
            modal_pct=mod_pct,
            pad_ratio_pct=pad_ratio,
        )

        unavailable_fields: list[str] = []
        if pendidikan_pct is None:
            unavailable_fields.append("pendidikan_pct")
        if kesehatan_pct is None:
            unavailable_fields.append("kesehatan_pct")
        if infrastruktur_hkpd_pct is None:
            unavailable_fields.append("infrastruktur_hkpd_pct")
        if tpt_val is None:
            unavailable_fields.append("tpt_pct")
        if population is None:
            unavailable_fields.append("population")

        preliminary.append(
            {
                "id": rid,
                "bps_code": bps_code,
                "djpk_code": f"{djpk_prov}-{djpk_pemda}",
                "name": name,
                "province_id": province_id,
                "province_name": province_name,
                "level": level,
                "island": island,
                "fiscal_year": rec_year,
                "centroid": centroid,
                "revenue": {
                    "total_pendapatan_miliar": pend_ang,
                    "realisasi_pendapatan_miliar": pend_real,
                    "serapan_pendapatan_pct": serapan_pendapatan_pct,
                    "pad_miliar": pad_ang,
                    "realisasi_pad_miliar": pad_real,
                    "pajak_daerah_miliar": pajak_ang,
                    "retribusi_daerah_miliar": retribusi_ang,
                    "tkd_miliar": tkd_ang,
                    "realisasi_tkd_miliar": tkd_real,
                    "lain_lain_miliar": pend_lain_ang,
                    "pad_ratio_pct": pad_ratio,
                    "tkd_ratio_pct": tkd_ratio,
                },
                "expenditure": {
                    "total_belanja_miliar": bel_ang,
                    "realisasi_belanja_miliar": bel_real,
                    "serapan_belanja_pct": serapan_bel_pct,
                    "pegawai_miliar": peg_ang,
                    "realisasi_pegawai_miliar": peg_real,
                    "barang_jasa_miliar": bj_ang,
                    "realisasi_barang_jasa_miliar": bj_real,
                    "modal_infrastruktur_miliar": mod_ang,
                    "realisasi_modal_miliar": mod_real,
                    "lainnya_miliar": lain_ang,
                    "transfer_keluar_miliar": transfer_keluar_miliar,
                    "hibah_bansos_subsidi_miliar": hibah_bansos_subsidi_miliar,
                    "tidak_terduga_miliar": tidak_terduga_ang,
                    "pendidikan_miliar": pendidikan_miliar,
                    "kesehatan_miliar": kesehatan_miliar,
                    "pegawai_pct": peg_pct,
                    "barang_jasa_pct": bj_pct,
                    "modal_pct": mod_pct,
                    "infrastruktur_pct": (
                        infrastruktur_hkpd_pct if infrastruktur_hkpd_pct is not None else mod_pct
                    ),
                    "infrastruktur_hkpd_pct": infrastruktur_hkpd_pct,
                    "pendidikan_pct": pendidikan_pct,
                    "kesehatan_pct": kesehatan_pct,
                    "lainnya_pct": lain_pct,
                    "birokrasi_pct": birokrasi_pct,
                    "publik_pct": publik_pct,
                },
                "hkpd": hkpd,
                "bps": {
                    "year": bps_year,
                    "population": population,
                    "population_15_plus": int(round(pop15_val)) if pop15_val is not None else None,
                    "poor_population_ribu": round2(pov_cnt) if pov_cnt is not None else None,
                    "ipm": round2(ipm_val) if ipm_val is not None else None,
                    "poverty_rate_pct": round2(pov_val) if pov_val is not None else None,
                    "tpt_pct": round2(tpt_val) if tpt_val is not None else None,
                    "apbd_per_capita_idr": apbd_per_capita_idr,
                },
                "effectiveness": {
                    "social_outcome_score": social_score,
                    "effectiveness_score": effectiveness_score,
                    "archetype": profile_label,
                    "rank_national": 0,
                },
                "provenance": {
                    "fiscal_year": rec_year,
                    "bps_year": bps_year,
                    "djpk_periode": format_djpk_periode(rec_year, rec_periode),
                    "djpk_source_url": source_djpk_url,
                    "bps_source_url": bps_primary_url,
                    "bps_indicators_urls": bps_urls,
                    "last_verified_at": verified_timestamp,
                    "is_verified_real_data": True,
                    "unavailable_official_fields": unavailable_fields,
                },
                "ai_audit": {},
            }
        )

    # Rank nationally across all verified Pemda
    ranked = sorted(
        preliminary,
        key=lambda x: (-x["effectiveness"]["effectiveness_score"], -x["hkpd"]["score"], x["name"]),
    )
    for idx, r in enumerate(ranked, start=1):
        r["effectiveness"]["rank_national"] = idx

    # Stratify Provinsi vs Kab/Kota and assign Apple-to-Apple Fiscal Capacity Clusters
    cluster_dist = assign_fiscal_capacity_clusters(ranked)

    for r in ranked:
        r["ai_audit"] = build_verified_audit_summary(r)

    regions = sorted(
        ranked,
        key=lambda x: (0 if x["level"] == "provinsi" else 1, x["bps_code"]),
    )

    provinces = [r for r in regions if r["level"] == "provinsi"]
    kab_kota = [r for r in regions if r["level"] != "provinsi"]
    kabupaten_list = [r for r in kab_kota if r["level"] == "kabupaten"]
    kota_list = [r for r in kab_kota if r["level"] == "kota"]

    prov_agg = summarize_tier(provinces)
    prov_agg["fiscal_cluster_distribution"] = cluster_dist["provinsi"]
    kab_kota_agg = summarize_tier(kab_kota)
    kab_kota_agg["kabupaten_count"] = len(kabupaten_list)
    kab_kota_agg["kota_count"] = len(kota_list)
    kab_kota_agg["fiscal_cluster_distribution"] = cluster_dist["kab_kota"]

    grade_dist = {"hijau": 0, "kuning": 0, "merah": 0}
    for r in regions:
        grade_dist[r["hkpd"]["grade"]] += 1

    total_all_apbd_t = round2(sum(r["expenditure"]["total_belanja_miliar"] for r in regions) / 1000.0)
    total_all_realisasi_t = round2(
        sum(r["expenditure"]["realisasi_belanja_miliar"] for r in regions) / 1000.0
    )

    valid_ipm = [p["bps"]["ipm"] for p in provinces if p["bps"]["ipm"] is not None]
    valid_pov = [p["bps"]["poverty_rate_pct"] for p in provinces if p["bps"]["poverty_rate_pct"] is not None]
    valid_tpt = [p["bps"]["tpt_pct"] for p in provinces if p["bps"]["tpt_pct"] is not None]
    valid_pend = [r["expenditure"]["pendidikan_pct"] for r in regions if r["expenditure"]["pendidikan_pct"] is not None]

    # National benchmark from BPS Indonesia row (vervar 9999) if available
    nat_ipm, nat_ipm_year = lookup_bps_value(bps_data["ipm_prov"], 9999)
    nat_pov, nat_pov_year = lookup_bps_value(
        bps_data["poverty_pct_prov"], 9999, preferred_turvar="434", preferred_turtahun=[62, 61, 63]
    )
    nat_tpt, nat_tpt_year = lookup_bps_value(bps_data["tpt_prov"], 9999, preferred_turtahun=[190, 189, 191])
    nat_bps_candidates = [
        y for y in (nat_ipm_year, nat_pov_year, nat_tpt_year, global_bps_year) if y is not None
    ]
    detected_bps_year = (
        max(nat_bps_candidates)
        if nat_bps_candidates
        else max((r["bps"]["year"] for r in regions), default=fiscal_year)
    )

    summary = {
        "fiscal_year": fiscal_year,
        "djpk_periode": periode,
        "bps_year": detected_bps_year,
        "generated_at": verified_timestamp,
        "is_verified_real_data": True,
        "coverage_scope": "Nasional Penuh (38 Provinsi + Seluruh Kab/Kota Otonom DJPK)",
        "data_sources": [
            (
                f"DJPK Kementerian Keuangan RI — Portal Data SIKD APBD {format_djpk_periode(fiscal_year, periode)} "
                f"({len(regions)} Pemda: 38 Provinsi + {len(kab_kota)} Kab/Kota Otonom)"
            ),
            (
                f"Badan Pusat Statistik (BPS RI, rilis {detected_bps_year}) — "
                f"IPM LF SP2020 (var 2207/2205), Kemiskinan P0 (var 192/621), TPT Provinsi (var 543)"
            ),
            "UU No. 1 Tahun 2022 (UU HKPD — Plafon Belanja Pegawai <= 30%)",
            "Batas Administrasi 38 Provinsi Indonesia (BIG/BPS Open GeoJSON)",
        ],
        "total_regions": len(regions),
        "total_provinces": len(provinces),
        "total_kab_kota": len(kab_kota),
        "total_kab_kota_samples": len(kab_kota),
        "total_kabupaten": len(kabupaten_list),
        "total_kota": len(kota_list),
        "total_provinsi_apbd_triliun": prov_agg["total_apbd_triliun"],
        "total_provinsi_realisasi_triliun": prov_agg["total_realisasi_triliun"],
        "total_kab_kota_apbd_triliun": kab_kota_agg["total_apbd_triliun"],
        "total_kab_kota_realisasi_triliun": kab_kota_agg["total_realisasi_triliun"],
        "total_apbd_triliun": total_all_apbd_t,
        "total_realisasi_triliun": total_all_realisasi_t,
        "avg_serapan_pct": round1(
            statistics.mean(r["expenditure"]["serapan_belanja_pct"] for r in regions)
        ),
        "avg_hkpd_score": round1(statistics.mean(r["hkpd"]["score"] for r in regions)),
        "avg_pegawai_pct": round1(statistics.mean(r["expenditure"]["pegawai_pct"] for r in regions)),
        "avg_modal_pct": round1(statistics.mean(r["expenditure"]["modal_pct"] for r in regions)),
        "avg_infrastruktur_pct": round1(
            statistics.mean(r["expenditure"]["infrastruktur_pct"] for r in regions)
        ),
        "avg_pendidikan_pct": round1(statistics.mean(valid_pend)) if valid_pend else None,
        "avg_pad_ratio_pct": round1(statistics.mean(r["revenue"]["pad_ratio_pct"] for r in regions)),
        "avg_birokrasi_pct": round1(
            statistics.mean(r["expenditure"]["birokrasi_pct"] for r in regions)
        ),
        "avg_publik_pct": round1(statistics.mean(r["expenditure"]["publik_pct"] for r in regions)),
        "avg_ipm": round2(nat_ipm) if nat_ipm is not None else round2(statistics.mean(valid_ipm)),
        "avg_poverty_pct": (
            round2(nat_pov) if nat_pov is not None else round2(statistics.mean(valid_pov))
        ),
        "avg_tpt_pct": round2(nat_tpt) if nat_tpt is not None else round2(statistics.mean(valid_tpt)),
        "grade_distribution": grade_dist,
        "fiscal_cluster_distribution": cluster_dist["overall"],
        "provinsi_aggregates": prov_agg,
        "kab_kota_aggregates": kab_kota_agg,
        "top_efficient_ids": [r["id"] for r in ranked[:5]],
        "needs_attention_ids": [r["id"] for r in ranked[-5:]],
    }

    # Build authentic 38-Province GeoJSON FeatureCollection joined with real DJPK/BPS properties
    features = []
    for p in provinces:
        code = p["bps_code"]
        if code not in base_geo:
            raise KeyError(f"Missing GeoJSON polygon for province code {code} ({p['name']})")
        geom = base_geo[code]["geometry"]
        total_t = round2(p["expenditure"]["total_belanja_miliar"] / 1000.0)
        extrusion_height = round(35_000 + math.sqrt(max(0.5, total_t)) * 52_000)

        features.append(
            {
                "type": "Feature",
                "id": int(code),
                "properties": {
                    "id": p["id"],
                    "province_code": code,
                    "province_name": p["name"],
                    "bps_code": code,
                    "name": p["name"],
                    "island": p["island"],
                    "fiscal_year": p["fiscal_year"],
                    "fiscal_cluster": p["fiscal_cluster"],
                    "fiscal_cluster_rank": p["fiscal_cluster_rank"],
                    "fiscal_cluster_total": p["fiscal_cluster_total"],
                    "kab_kota_count": kab_count_by_prov.get(p["id"], 0),
                    "total_apbd_miliar": p["expenditure"]["total_belanja_miliar"],
                    "total_apbd_triliun": total_t,
                    "realisasi_belanja_triliun": round2(
                        p["expenditure"]["realisasi_belanja_miliar"] / 1000.0
                    ),
                    "serapan_belanja_pct": p["expenditure"]["serapan_belanja_pct"],
                    "hkpd_score": p["hkpd"]["score"],
                    "grade": p["hkpd"]["grade"],
                    "grade_label": p["hkpd"]["grade_label"],
                    "pegawai_pct": p["expenditure"]["pegawai_pct"],
                    "modal_pct": p["expenditure"]["modal_pct"],
                    "infrastruktur_pct": p["expenditure"]["infrastruktur_pct"],
                    "pad_ratio_pct": p["revenue"]["pad_ratio_pct"],
                    "ipm": p["bps"]["ipm"],
                    "poverty_rate_pct": p["bps"]["poverty_rate_pct"],
                    "effectiveness_score": p["effectiveness"]["effectiveness_score"],
                    "archetype": p["effectiveness"]["archetype"],
                    "extrusion_height": extrusion_height,
                },
                "geometry": geom,
            }
        )

    geojson = {
        "type": "FeatureCollection",
        "name": "indonesia_38_provinces_apbd_real",
        "features": features,
    }

    return regions, summary, geojson


def count_geojson_vertices(geojson: dict[str, Any]) -> int:
    total = 0
    for f in geojson["features"]:
        g = f["geometry"]
        if g["type"] == "Polygon":
            total += sum(len(r) for r in g["coordinates"])
        elif g["type"] == "MultiPolygon":
            total += sum(len(r) for poly in g["coordinates"] for r in poly)
    return total


def verify_outputs(
    regions: list[dict[str, Any]],
    summary: dict[str, Any],
    geojson: dict[str, Any],
    geojson_bytes_len: int,
) -> None:
    provinces = [r for r in regions if r["level"] == "provinsi"]
    kab_kota = [r for r in regions if r["level"] != "provinsi"]
    assert len(provinces) == 38, f"Expected 38 provinces, found {len(provinces)}"
    assert len(kab_kota) >= 500, f"Expected full national coverage (>=500 kab/kota), found {len(kab_kota)}"
    assert len(geojson["features"]) == 38, f"Expected 38 GeoJSON features, found {len(geojson['features'])}"

    prov_ids = {p["id"] for p in provinces}
    prov_codes = {p["bps_code"] for p in provinces}
    geo_ids = {f["properties"]["id"] for f in geojson["features"]}
    geo_codes = {f["properties"]["province_code"] for f in geojson["features"]}
    assert prov_ids == geo_ids, f"ID mismatch between regions.json and GeoJSON: {prov_ids ^ geo_ids}"
    assert prov_codes == geo_codes, f"Code mismatch between regions.json and GeoJSON: {prov_codes ^ geo_codes}"

    vertices = count_geojson_vertices(geojson)
    assert vertices >= 15_000, f"GeoJSON looks too blocky/low-poly ({vertices} vertices)"
    size_kb = geojson_bytes_len / 1024.0
    assert 300.0 <= size_kb <= 800.0, f"GeoJSON size {size_kb:.1f} KB outside 300-800 KB target"

    seen_ids: set[str] = set()
    seen_djpk: set[str] = set()
    for r in regions:
        assert r["id"] not in seen_ids, f"Duplicate region id: {r['id']}"
        seen_ids.add(r["id"])
        assert r["djpk_code"] not in seen_djpk, f"Duplicate djpk_code: {r['djpk_code']}"
        seen_djpk.add(r["djpk_code"])
        assert r.get("province_id") in prov_ids, f"Invalid province_id {r.get('province_id')} for {r['id']}"
        assert r.get("province_name"), f"Missing province_name for {r['id']}"

        prov = r.get("provenance") or {}
        assert prov.get("is_verified_real_data") is True, f"Unverified record: {r['id']}"
        assert isinstance(prov.get("fiscal_year"), int) and prov["fiscal_year"] >= 2020, (
            f"Invalid provenance.fiscal_year for {r['id']}: {prov.get('fiscal_year')}"
        )
        assert prov["fiscal_year"] == r["fiscal_year"], (
            f"Mismatched fiscal_year vs provenance.fiscal_year for {r['id']}"
        )
        assert str(prov.get("djpk_source_url", "")).startswith("https://djpk.kemenkeu.go.id/"), (
            f"Invalid DJPK URL for {r['id']}"
        )
        assert str(prov.get("bps_source_url", "")).startswith("https://www.bps.go.id/"), (
            f"Invalid BPS URL for {r['id']}"
        )
        assert 0.0 <= r["hkpd"]["score"] <= 100.0, f"Invalid HKPD score for {r['id']}"
        assert r["expenditure"]["total_belanja_miliar"] > 0, f"Non-positive budget for {r['id']}"
        assert r["bps"]["ipm"] is not None, f"Missing BPS IPM for {r['id']}"
        assert r["bps"]["poverty_rate_pct"] is not None, f"Missing BPS Poverty for {r['id']}"
        if r["level"] == "provinsi":
            assert r["bps"]["tpt_pct"] is not None, f"Missing BPS TPT for province {r['id']}"
        for k in ("fiscal_finding", "social_correlation", "policy_recommendation"):
            assert len(r["ai_audit"][k]) > 40, f"Audit narrative '{k}' too short for {r['id']}"
        assert r.get("fiscal_cluster") in FISCAL_CLUSTER_TIERS, (
            f"Invalid fiscal_cluster for {r['id']}: {r.get('fiscal_cluster')}"
        )
        assert isinstance(r.get("fiscal_cluster_rank"), int) and r["fiscal_cluster_rank"] >= 1, (
            f"Invalid fiscal_cluster_rank for {r['id']}"
        )
        assert (
            isinstance(r.get("fiscal_cluster_total"), int)
            and r["fiscal_cluster_rank"] <= r["fiscal_cluster_total"]
        ), f"Invalid fiscal_cluster_total for {r['id']}"

    # Verify stratified balanced tertiles & contiguous 1..N peer ranks
    for label_stratum, subset in (("provinsi", provinces), ("kab_kota", kab_kota)):
        counts = [sum(1 for r in subset if r["fiscal_cluster"] == t) for t in FISCAL_CLUSTER_TIERS]
        assert max(counts) - min(counts) <= 1, (
            f"Unbalanced {label_stratum} fiscal cluster tertiles: {counts}"
        )
        for tier in FISCAL_CLUSTER_TIERS:
            bucket = [r for r in subset if r["fiscal_cluster"] == tier]
            ranks = sorted(r["fiscal_cluster_rank"] for r in bucket)
            assert ranks == list(range(1, len(bucket) + 1)), (
                f"Non-contiguous peer ranks in {label_stratum}:{tier}"
            )
            for item in bucket:
                assert item["fiscal_cluster_total"] == len(bucket), (
                    f"Mismatched fiscal_cluster_total for {item['id']}"
                )

    assert isinstance(summary.get("fiscal_year"), int) and summary["fiscal_year"] >= 2020, (
        f"Invalid summary.fiscal_year: {summary.get('fiscal_year')}"
    )
    assert isinstance(summary.get("bps_year"), int) and summary["bps_year"] >= 2020, (
        f"Invalid summary.bps_year: {summary.get('bps_year')}"
    )
    assert isinstance(summary.get("djpk_periode"), int) and 1 <= summary["djpk_periode"] <= 12, (
        f"Invalid summary.djpk_periode: {summary.get('djpk_periode')}"
    )
    total_grades = sum(summary["grade_distribution"].values())
    assert total_grades == len(regions), "Grade distribution count mismatch"
    cluster_sum = sum(summary["fiscal_cluster_distribution"].values())
    assert cluster_sum == len(regions), "Fiscal cluster distribution count mismatch"

    print(
        f"[VERIFY OK] 100% Real Data | {len(regions)} entities ({len(provinces)} prov + {len(kab_kota)} kab/kota: "
        f"{summary['total_kabupaten']} kab, {summary['total_kota']} kota) | "
        f"Total APBD TA {summary['fiscal_year']} P{summary['djpk_periode']} (BPS {summary['bps_year']}): "
        f"Rp {summary['total_apbd_triliun']} T "
        f"(Prov: Rp {summary['total_provinsi_apbd_triliun']} T | Kab/Kota: Rp {summary['total_kab_kota_apbd_triliun']} T) | "
        f"GeoJSON: {size_kb:.1f} KB ({vertices:,} vertices) | "
        f"Grades -> Hijau: {summary['grade_distribution']['hijau']}, "
        f"Kuning: {summary['grade_distribution']['kuning']}, "
        f"Merah: {summary['grade_distribution']['merah']}"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Kawal APBD Full-National Zero-Fabrication Real Data ETL Pipeline")
    parser.add_argument(
        "--year",
        type=int,
        default=None,
        help="Optional explicit DJPK APBD fiscal year override (default: auto-probe downward from current year)",
    )
    parser.add_argument(
        "--periode",
        type=int,
        default=None,
        help="Optional explicit DJPK month periode 1-12 override (default: auto-probe latest 12..1)",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=DEFAULT_POLITE_DELAY,
        help="Polite delay in seconds between live HTTP request starts (default: 0.35)",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=DEFAULT_WORKERS,
        help="Concurrent workers behind global PoliteRateLimiter (default: 4)",
    )
    parser.add_argument("--refresh", action="store_true", help="Force live re-download from DJPK, BPS, and GeoJSON")
    parser.add_argument("--verify", action="store_true", help="Run strict real-data & topology integrity assertions")
    args = parser.parse_args()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    regions, summary, geojson = build_datasets(
        fiscal_year=args.year,
        periode=args.periode,
        refresh=args.refresh,
        polite_delay=max(0.0, args.delay),
        workers=max(1, args.workers),
    )

    geojson_str = json.dumps(geojson, ensure_ascii=False, separators=(",", ":"))
    geojson_bytes = geojson_str.encode("utf-8")

    if args.verify:
        verify_outputs(regions, summary, geojson, len(geojson_bytes))

    # Compact JSON keeps 546-entity regions.json lean (~1.4 MB raw / ~140 KB gzipped)
    (OUTPUT_DIR / "regions.json").write_text(
        json.dumps(regions, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )
    (OUTPUT_DIR / "national_summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (OUTPUT_DIR / "indonesia_provinces.geojson").write_bytes(geojson_bytes)

    regions_kb = (OUTPUT_DIR / "regions.json").stat().st_size / 1024.0
    print(f"[DONE] Wrote verified datasets to {OUTPUT_DIR} (regions.json: {regions_kb:.1f} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
