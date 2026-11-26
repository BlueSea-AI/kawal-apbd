# Kawal APBD — Rapor Kesehatan Uang Rakyat

Platform intelijen & audit anggaran daerah interaktif berbasis **100% Open Public Data** dan arsitektur statis **$0 runtime cost** untuk seluruh **38 provinsi** dan sampel **14 kabupaten/kota** di Indonesia.

## Fitur Utama

1. **Scrollytelling Hero (`Ke Mana Perginya 1 Rupiah Uang Rakyat?`)** — Intro jurnalisme data interaktif dengan GSAP & dukungan `prefers-reduced-motion`.
2. **Automated UU HKPD Audit Engine (UU No. 1 Tahun 2022)** — Evaluasi otomatis plafon Belanja Pegawai ($\le 30\%$), lantai Infrastruktur Pelayanan Publik ($\ge 40\%$), dan Mandatory Spending Pendidikan ($\ge 20\%$) ke dalam skor `0–100` serta lencana **Rapor Hijau / Kuning / Merah**.
3. **Peta Spasial 3D Nusantara (`MapLibre GL JS`)** — Poligon 38 provinsi Indonesia berekstrusi 3D (`Tinggi = Total APBD`, `Warna = Rapor UU HKPD`), bekerja 100% tanpa API key berbayar, dilengkapi toggle 3D/2D & fallback non-WebGL.
4. **Diagram Sankey Arus Uang APBD** — Visualisasi interaktif dari sumber pendapatan (`PAD`, `TKD`, `Lainnya`) $\rightarrow$ `Kas APBD` $\rightarrow$ pos belanja, lengkap dengan toggle tabel aksesibel.
5. **Korelasi Lintas Data BPS (`Indeks Efektivitas Uang Rakyat`)** — Scatter plot korelasi skor UU HKPD terhadap IPM, Tingkat Kemiskinan, dan TPT BPS.
6. **Pre-Computed AI Fiscal Auditor** — 3 poin audit tajam per daerah yang sudah dipra-komputasi (termasuk template batch Gemini API di `scripts/generate_ai_audits.py`).
7. **Struk Belanja Pajak (`Receiptify`-style PNG Generator)** — Masukkan nominal pajak tahunanmu, lihat rincian tiap Rupiah ke Birokrasi vs. Publik, lalu unduh struk thermal PNG resolusi 2x via `html-to-image`.
8. **Adu Efisiensi Daerah (1v1 Head-to-Head)** — Duel langsung 2 daerah melintasi 7 metrik fiskal & sosial BPS.

## Menjalankan Proyek

```bash
# 1. Regenerasi & verifikasi dataset terbuka (38 Provinsi + 14 Kab/Kota)
python scripts/etl_pipeline.py --verify

# 2. Jalankan pengembangan lokal
npm install
npm run dev

# 3. Verifikasi build produksi & unit test audit
npm run typecheck
npm run lint
node --test tests/audit-engine.test.mjs
npm run build
```

## Dokumentasi Arsitektur
- [Product Requirements Document (PRD)](docs/PRD.md)
- [Technical Specification (TECH_SPEC)](docs/TECH_SPEC.md)
- [Execution Plan](docs/EXECUTION_PLAN.md)
- [Progress Tracker](docs/PROGRESS.md)
