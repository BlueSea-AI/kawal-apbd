#!/usr/bin/env python3
"""
Kawal APBD — Verified-Data AI Auditor Batch Script (Gemini API)
===============================================================
Generates 3 sharp, plain-Indonesian fiscal audit insights per region in batch
and stores them directly inside public/data/regions.json.

STRICT ANTI-HALLUCINATION PROTOCOL:
  - Prompt passes ONLY verified non-null figures from DJPK Kemenkeu & BPS RI.
  - Any unpublished official field (value is None) is explicitly marked
    "Data Belum Dipublikasikan Resmi" with an explicit instruction NOT to
    invent, guess, or extrapolate missing numbers.

Usage:
  python scripts/generate_ai_audits.py --dry-run --limit 2
  set GEMINI_API_KEY=your_key_here
  python scripts/generate_ai_audits.py --model gemini-2.5-flash
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT_DIR = Path(__file__).resolve().parent.parent
REGIONS_PATH = ROOT_DIR / "public" / "data" / "regions.json"


def fmt_opt(val: float | int | None, suffix: str = "") -> str:
    if val is None:
        return "Data Belum Dipublikasikan Resmi"
    return f"{val}{suffix}"


def build_prompt(region: dict[str, Any]) -> str:
    exp = region["expenditure"]
    rev = region["revenue"]
    hkpd = region["hkpd"]
    bps = region["bps"]
    eff = region["effectiveness"]
    prov = region.get("provenance") or {}

    return (
        "Kamu adalah Auditor Fiskal Independen dan Jurnalis Data Investigasi Indonesia (gaya Katadata / Tempo Data).\n"
        "ATURAN KETAT: Gunakan HANYA angka terverifikasi di bawah ini. DILARANG KERAS mengarang, menebak, "
        "atau mengisi angka untuk metrik yang bertuliskan 'Data Belum Dipublikasikan Resmi'.\n\n"
        f"Entitas: {region['name']} ({region['level'].upper()}, Kode BPS {region['bps_code']})\n"
        f"Sumber APBD: DJPK Kemenkeu RI — TA {region['fiscal_year']} ({prov.get('djpk_periode', 'TA ' + str(region['fiscal_year']))})\n"
        f"- Total Pendapatan (Anggaran): Rp {rev['total_pendapatan_miliar']:,.1f} Miliar "
        f"(Realisasi: Rp {rev['realisasi_pendapatan_miliar']:,.1f} Miliar / {rev['serapan_pendapatan_pct']}%)\n"
        f"- Kemandirian Fiskal (PAD): {rev['pad_ratio_pct']}% | Transfer Pusat (TKD): {rev['tkd_ratio_pct']}%\n"
        f"- Total Belanja (Anggaran): Rp {exp['total_belanja_miliar']:,.1f} Miliar "
        f"(Realisasi: Rp {exp['realisasi_belanja_miliar']:,.1f} Miliar / {exp['serapan_belanja_pct']}%)\n"
        f"- Belanja Pegawai: {exp['pegawai_pct']}% (Rp {exp['pegawai_miliar']:,.1f} M; Batas UU HKPD <= 30%)\n"
        f"- Belanja Barang & Jasa: {exp['barang_jasa_pct']}% (Rp {exp['barang_jasa_miliar']:,.1f} M)\n"
        f"- Belanja Modal (Aset & Infrastruktur DJPK): {exp['modal_pct']}% (Rp {exp['modal_infrastruktur_miliar']:,.1f} M)\n"
        f"- Belanja Fungsi Pendidikan: {fmt_opt(exp.get('pendidikan_pct'), '%')}\n"
        f"- Belanja Fungsi Kesehatan: {fmt_opt(exp.get('kesehatan_pct'), '%')}\n"
        f"- Skor Audit Fiskal: {hkpd['score']}/100 ({hkpd['grade_label']}) — Basis: {hkpd['scoring_basis']}\n"
        f"Sumber Sosial: BPS RI ({bps['year']})\n"
        f"- IPM (LF SP2020): {fmt_opt(bps.get('ipm'))}\n"
        f"- Persentase Penduduk Miskin (P0): {fmt_opt(bps.get('poverty_rate_pct'), '%')}\n"
        f"- Tingkat Pengangguran Terbuka (TPT): {fmt_opt(bps.get('tpt_pct'), '%')}\n"
        f"- Profil Efektivitas: {eff['archetype']} (Skor {eff['effectiveness_score']}/100, Peringkat #{eff['rank_national']})\n\n"
        "Kembalikan HANYA objek JSON valid dengan 3 kunci string bahasa Indonesia jurnalistik yang tajam, "
        "faktual, ringkas (maks 2 kalimat per poin), dan 100% merujuk pada angka terverifikasi di atas:\n"
        "{\n"
        '  "fiscal_finding": "Temuan utama postur belanja pegawai, belanja modal, realisasi serapan, dan kemandirian PAD",\n'
        '  "social_correlation": "Korelasi ukuran dan kualitas belanja terhadap indikator BPS yang tersedia",\n'
        '  "policy_recommendation": "1 rekomendasi konkret pengawalan publik/DPRD berbasis celah angka di atas"\n'
        "}"
    )


def call_gemini_rest(api_key: str, model: str, prompt: str) -> dict[str, str]:
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent?key={api_key}"
    )
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json",
        },
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = json.loads(resp.read().decode("utf-8"))

    raw_text = body["candidates"][0]["content"]["parts"][0]["text"]
    parsed = json.loads(raw_text)
    for field in ("fiscal_finding", "social_correlation", "policy_recommendation"):
        if field not in parsed or not isinstance(parsed[field], str):
            raise ValueError(f"Missing expected key '{field}' in Gemini response")
    return parsed


def main() -> int:
    parser = argparse.ArgumentParser(description="Batch-generate verified AI audit insights for Kawal APBD")
    parser.add_argument("--dry-run", action="store_true", help="Print sample prompts without calling Gemini API")
    parser.add_argument("--model", default="gemini-2.5-flash", help="Gemini model ID")
    parser.add_argument("--limit", type=int, default=0, help="Limit number of regions to process (0 = all)")
    parser.add_argument("--delay", type=float, default=1.0, help="Seconds to wait between API calls")
    args = parser.parse_args()

    if not REGIONS_PATH.exists():
        print(f"[ERROR] {REGIONS_PATH} not found. Run scripts/etl_pipeline.py first.", file=sys.stderr)
        return 1

    regions: list[dict[str, Any]] = json.loads(REGIONS_PATH.read_text(encoding="utf-8"))
    target_regions = regions[: args.limit] if args.limit > 0 else regions

    # Verify every record before prompt generation
    for r in target_regions:
        if not (r.get("provenance") or {}).get("is_verified_real_data"):
            print(f"[ERROR] Refusing to audit unverified region record: {r.get('id')}", file=sys.stderr)
            return 1

    if args.dry_run:
        print(f"[DRY-RUN] Previewing {len(target_regions)} verified prompts for model '{args.model}':\n")
        for r in target_regions:
            print("=" * 64)
            print(f"REGION: {r['name']} ({r['id']}) | Verified Real Data: TRUE")
            print(build_prompt(r))
        return 0

    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        print(
            "[ERROR] GEMINI_API_KEY environment variable is not set.\n"
            "Tip: Run with --dry-run to preview verified prompts, or export GEMINI_API_KEY first.",
            file=sys.stderr,
        )
        return 1

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    updated = 0

    for idx, region in enumerate(target_regions, start=1):
        prompt = build_prompt(region)
        try:
            insight = call_gemini_rest(api_key, args.model, prompt)
            region["ai_audit"] = {
                "fiscal_finding": insight["fiscal_finding"].strip(),
                "social_correlation": insight["social_correlation"].strip(),
                "policy_recommendation": insight["policy_recommendation"].strip(),
                "generated_by": f"Gemini Verified Auditor ({args.model})",
                "audited_at": today,
            }
            updated += 1
            print(f"[{idx}/{len(target_regions)}] Audited {region['name']} OK")
        except (urllib.error.URLError, ValueError, KeyError, json.JSONDecodeError) as exc:
            print(f"[{idx}/{len(target_regions)}] Skipped {region['name']} ({exc})", file=sys.stderr)
        if idx < len(target_regions):
            time.sleep(args.delay)

    REGIONS_PATH.write_text(json.dumps(regions, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n[DONE] Updated {updated}/{len(target_regions)} regions in {REGIONS_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
