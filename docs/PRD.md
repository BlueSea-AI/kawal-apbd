# Product Requirements Document (PRD)
## Kawal APBD — Rapor Kesehatan Uang Rakyat

**Version:** 1.0.0  
**Status:** Approved for Autonomous Execution  
**Architecture:** Zero-Cost ($0) Static Civic-Tech Intelligence Platform  
**Primary Language:** Bahasa Indonesia (UI & Editorial) / English (Engineering Docs)

---

## 1. Vision & Core Problem

Every year, trillions of Rupiah in Indonesian Regional Budgets (**APBD — Anggaran Pendapatan dan Belanja Daerah**) are allocated across 38 provinces and 514 regencies/cities (*Kabupaten/Kota*). While raw budget realizations are published on the Directorate General of Fiscal Balance (**DJPK Kementerian Keuangan**) portal and socioeconomic indicators on **BPS (Badan Pusat Statistik)**, ordinary citizens face three severe barriers:

1. **Data Opacity & Jargon:** Raw fiscal tables bury critical ratios (how much goes to bureaucratic salaries vs. public schools, clinics, and roads) inside dozens of dense accounting codes.
2. **Disconnected Outcomes:** Budget tables never show whether high regional spending actually reduces poverty (*Tingkat Kemiskinan*), lowers open unemployment (*TPT*), or improves the Human Development Index (*IPM*).
3. **Lack of Personal Relevance:** Citizens rarely feel a tangible connection between their taxes/retributions and how their own regional government spends every Rp 1.

**Kawal APBD (Rapor Kesehatan Uang Rakyat)** solves this by transforming open DJPK + BPS datasets into a fintech-grade civic audit dashboard that automatically evaluates every region against **UU No. 1 Tahun 2022 (UU HKPD)**, maps budget scale vs. efficiency in 3D, traces money flow via interactive Sankey diagrams, and gives citizens shareable viral tools (*Struk Belanja Pajak* & *Adu Efisiensi Daerah*).

---

## 2. Target User Personas

| Persona | Profile | Primary Goals | Signature Features Used |
| :--- | :--- | :--- | :--- |
| **Warga & Pembayar Pajak** | Urban/suburban Indonesian citizens (ages 20–45) active on social media | Understand where their Rp 1.000.000 tax goes in their own city/province; share visual proof | Scrollytelling Hero, *Struk Belanja Pajak* (PNG export), *Adu Efisiensi Daerah* |
| **Jurnalis Data & Peneliti** | Investigative reporters, civic-tech analysts, academics | Audit UU HKPD compliance, spot anomalies ("Anggaran Besar, Dampak Minim"), inspect money flow | 3D Spatial Map, Sankey Money Flow, AI Auditor Card, Filterable Audit Table |
| **Aktivis & CSO Antikorupsi** | Regional budget watchdogs (FITRA, ICW, local NGOs) | Benchmark local governments against neighbors and statutory ceilings | 1v1 Head-to-Head Duel, UU HKPD Threshold Breakdown, Effectiveness Matrix |
| **Pembuat Kebijakan / DPRD** | Regional legislators and fiscal planners | Quickly diagnose budget rigidity (*Belanja Pegawai* bloat) vs. public service gaps | Bento KPI Overview, Compliance Scorecard, Pre-Computed Audit Recommendations |

---

## 3. Exact Mathematical Formulas

### 3.1. Automated Legal Audit Engine — UU No. 1 Tahun 2022 (UU HKPD)

Based on Indonesian statutory *Mandatory Spending* rules (UU HKPD & UUD 1945 mandate):

1. **Belanja Pegawai (Personnel / Bureaucracy Ceiling):**
   - Statutory Target: $\le 30\%$ of Total Belanja Daerah (evaluated strictly against total expenditure for transparency).
   - Weight: **40 points** (35 base for compliance + up to 5 efficiency headroom bonus).
   - Formula:
     $$S_{\text{pegawai}} = \begin{cases} 35 + \min\left(5,\; (30 - P_{\text{pegawai}}) \times 0.625\right) & \text{if } P_{\text{pegawai}} \le 30 \\ \max\left(0,\; 35 - (P_{\text{pegawai}} - 30) \times 3.0\right) & \text{if } P_{\text{pegawai}} > 30 \end{cases}$$

2. **Belanja Infrastruktur Pelayanan Publik (Public Infrastructure Floor):**
   - Statutory Target: $\ge 40\%$ of Total Belanja Daerah.
   - Weight: **35 points** (30 base + up to 5 headroom bonus).
   - Formula:
     $$S_{\text{infra}} = \begin{cases} 30 + \min\left(5,\; (P_{\text{infra}} - 40) \times 0.625\right) & \text{if } P_{\text{infra}} \ge 40 \\ \max\left(0,\; 30 - (40 - P_{\text{infra}}) \times 1.8\right) & \text{if } P_{\text{infra}} < 40 \end{cases}$$

3. **Belanja Pendidikan (Education Floor):**
   - Statutory Target: $\ge 20\%$ of Total Belanja Daerah.
   - Weight: **25 points** (21 base + up to 4 headroom bonus).
   - Formula:
     $$S_{\text{pendidikan}} = \begin{cases} 21 + \min\left(4,\; (P_{\text{pendidikan}} - 20) \times 0.5\right) & \text{if } P_{\text{pendidikan}} \ge 20 \\ \max\left(0,\; 21 - (20 - P_{\text{pendidikan}}) \times 3.0\right) & \text{if } P_{\text{pendidikan}} < 20 \end{cases}$$

4. **Composite UU HKPD Compliance Score (`hkpd_score`):**
   $$\text{hkpd\_score} = \text{clamp}\left(\text{round}(S_{\text{pegawai}} + S_{\text{infra}} + S_{\text{pendidikan}},\; 1),\; 0,\; 100\right)$$

5. **Rapor Compliance Badge (`grade`):**
   - **Rapor Hijau** (`hijau`): `hkpd_score >= 80` — Patuh UU HKPD & Pro-Publik
   - **Rapor Kuning** (`kuning`): `60 <= hkpd_score < 80` — Perlu Perbaikan Alokasi
   - **Rapor Merah** (`merah`): `hkpd_score < 60` — Peringatan Defisit Pelayanan Publik / Birokrasi Gemuk

---

### 3.2. Cross-Data Correlation — "Indeks Efektivitas Uang Rakyat"

Correlates APBD fiscal governance with real-world BPS socioeconomic outcomes:

1. **Normalized BPS Social Outcome Sub-Index (`social_outcome_score`, 0–100):**
   - **IPM Score (weight 45%):**
     $$N_{\text{ipm}} = \text{clamp}\left(\frac{\text{IPM} - 55}{85 - 55} \times 100,\; 0,\; 100\right)$$
   - **Poverty Inverse Score (weight 35%):**
     $$N_{\text{kemiskinan}} = \text{clamp}\left(\frac{28 - \text{Kemiskinan}(\%)}{28 - 2} \times 100,\; 0,\; 100\right)$$
   - **Unemployment Inverse Score (weight 20%):**
     $$N_{\text{tpt}} = \text{clamp}\left(\frac{12 - \text{TPT}(\%)}{12 - 1.5} \times 100,\; 0,\; 100\right)$$
   - **Social Outcome Composite:**
     $$S_{\text{sosial}} = 0.45 \cdot N_{\text{ipm}} + 0.35 \cdot N_{\text{kemiskinan}} + 0.20 \cdot N_{\text{tpt}}$$

2. **Indeks Efektivitas Uang Rakyat (`effectiveness_score`, 0–100):**
   $$\text{effectiveness\_score} = \text{round}\left(0.55 \cdot \text{hkpd\_score} + 0.45 \cdot S_{\text{sosial}},\; 1\right)$$

3. **Regional Effectiveness Archetype (`classification`):**
   Let $M_{\text{cap}}$ be the national median APBD per capita across the dataset:
   - **`Efisien & Pro-Publik`**: `hkpd_score >= 75` AND `social_outcome_score >= 65`
   - **`Anggaran Besar, Dampak Minim`**: `apbd_per_capita >= M_cap` AND (`hkpd_score < 65` OR `social_outcome_score < 58`)
   - **`Keterbatasan Fiskal namun Inovatif`**: `apbd_per_capita < M_cap` AND `social_outcome_score >= 65`
   - **`Birokrasi Gemuk, Layanan Tertekan`**: `pegawai_pct > 36` AND `infra_pct < 32`
   - **`Transisi Reformasi Fiskal`**: All other regions actively bridging compliance and social outcomes.

4. **Bureaucracy vs. Public Service Ratio (`bureaucracy_vs_public`):**
   - **Belanja Birokrasi (%)** = `pegawai_pct + (barang_jasa_pct * 0.45)` (Salaries + routine administrative operational costs)
   - **Belanja Publik (%)** = `100 - bureaucracy_pct` (Infrastructure, Education, Health, Social Aid, Public Capital)

---

## 4. Functional Specifications

### 4.1. Scrollytelling Hero ("Ke Mana Perginya 1 Rupiah Anggaran Daerah?")
- Full-viewport editorial data-journalism intro with 3 interactive scroll/stepped beats powered by GSAP ScrollTrigger (with `prefers-reduced-motion` fallback & instant "Langsung ke Dashboard" skip button):
  1. **Beat 1 — Triliunan Rupiah APBD:** Visualizes the Rp 1.300+ Triliun national APBD pool across 38 provinces.
  2. **Beat 2 — Potongan Birokrasi vs. Publik:** Splits 1 Rupiah (or Rp 100) into Belanja Pegawai, Barang & Jasa, Infrastruktur, Pendidikan, and Kesehatan.
  3. **Beat 3 — Standar Hukum UU HKPD:** Reveals how many provinces earn Rapor Hijau, Kuning, and Merah, transitioning smoothly into the interactive Bento Dashboard.

### 4.2. Core Bento Grid Audit Dashboard
- Sticky Civic Navbar with brand mark, quick navigation (`Dashboard`, `Peta 3D`, `Struk Pajak`, `Adu Daerah`), region quick-switcher (38 Provinces + Sample Regencies/Cities), and accessible Dark/Light Mode toggle.
- **National & Selected-Region KPI Strip:** Animated numeric counters (`Total APBD`, `Skor UU HKPD`, `Belanja Pegawai %`, `Belanja Infrastruktur %`, `Indeks Efektivitas`).
- **Region Selector & Filter Bar:** Filter by Region Level (`Semua`, `Provinsi`, `Kabupaten/Kota`), Island Cluster (`Sumatera`, `Jawa`, `Kalimantan`, `Sulawesi`, `Bali & Nusa Tenggara`, `Maluku & Papua`), Rapor Badge (`Hijau`, `Kuning`, `Merah`), and search query.
- **UU HKPD Compliance Gauge & Threshold Bars:** Visual comparison of actual % vs. statutory threshold (30% max Pegawai, 40% min Infrastruktur, 20% min Pendidikan) with pass/fail indicators (icon + text + color, never color alone).
- **Pre-Computed AI Auditor Card:** Displays 3 sharp, plain-Indonesian audit insights (1 Fiscal Health Finding, 1 Social Correlation Finding, 1 Concrete Policy Recommendation) with source attribution and methodology badge.
- **Interactive Sankey Money Flow Diagram:** Dynamic SVG Sankey tracing Revenue (`PAD`, `Dana Transfer Pusat / TKD`, `Lain-lain Pendapatan Sah`) $\rightarrow$ `Total APBD` $\rightarrow$ Expenditure (`Belanja Pegawai`, `Belanja Barang & Jasa`, `Belanja Modal / Infrastruktur`, `Belanja Pendidikan`, `Belanja Kesehatan`, `Belanja Publik Lainnya`), with hover tooltips, exact Rupiah values, percentages, and an accessible toggleable data table fallback.
- **BPS Cross-Data Scatter / Correlation Matrix:** Interactive scatter plot (Recharts) mapping `Skor UU HKPD` (X) vs. `Skor Dampak Sosial BPS` (Y) with bubble size = Total APBD and quadrant labels.
- **Sortable Regional Leaderboard Table:** Full Shadcn `<Table>` listing all 50+ regions (all 38 provinces + 12+ major Kabupaten/Kota) with click-to-inspect selection.

### 4.3. Interactive 3D Spatial Map (`MapLibre GL JS`)
- Renders all 38 Indonesian provinces as 3D extruded polygons (`fill-extrusion` layer) using clean local GeoJSON (`public/data/indonesia_provinces.geojson`) — works 100% offline/zero-API-key with a crisp dark/light procedural basemap style (no Mapbox token required!).
- **Extrusion Height** = Proportional to `Total APBD (Triliun Rp)`.
- **Extrusion Color** = UU HKPD Efficiency Score (`Hijau #059669`, `Kuning #D97706`, `Merah #DC2626`).
- Interactive hover tooltip, click-to-select region (syncs with Dashboard & AI Auditor), pitch/bearing camera presets (`3D Isometrik`, `Tampak Atas 2D`, `Reset Nusantara`), and accessible keyboard/list fallback.

### 4.4. Viral Feature 1 — "Struk Belanja Pajak" (*Receiptify*-style PNG Generator)
- Dedicated section/tab where users:
  1. Select any Province or Kabupaten/Kota.
  2. Enter their annual tax/retribution contribution (default `Rp 1.000.000`, quick presets: `Rp 500rb`, `Rp 1 Jt`, `Rp 5 Jt`, `Rp 10 Jt`, or custom input).
  3. Optionally add their name/alias for the receipt header.
- Renders a hyper-authentic **thermal paper POS receipt** with serrated top/bottom edges, `Fira Code` tabular alignment, itemized breakdown of every Rupiah going to:
  - Gaji & Tunjangan Birokrasi (Belanja Pegawai)
  - Operasional & Perjalanan Dinas (Barang & Jasa)
  - Jalan, Jembatan & Infrastruktur Publik
  - Sekolah & Pendidikan Daerah
  - Rumah Sakit & Kesehatan Masyarakat
  - Bantuan Sosial & Layanan Lainnya
- Displays the region's **Rapor UU HKPD Stamp** (`RAPOR HIJAU / KUNING / MERAH`) and barcode footer (`KAWAL-APBD-2025`).
- One-click **"Unduh Struk (PNG)"** powered by `html-to-image` (`toPng` at 2x pixelRatio) + **"Salin Ringkasan Teks"** for instant X/Twitter/WhatsApp sharing.

### 4.5. Viral Feature 2 — "Adu Efisiensi Daerah" (1v1 Head-to-Head Mode)
- Side-by-side arena allowing users to pit any **Daerah A vs. Daerah B** (with quick curated duels like *"DKI Jakarta vs. DI Yogyakarta"*, *"Kota Surabaya vs. Kota Bandung"*, *"Jawa Tengah vs. Jawa Timur"*, *"Papua Tengah vs. Bali"*).
- Compares:
  - Total APBD & APBD per Kapita
  - Skor UU HKPD & Rapor Badge (Winner crown indicator)
  - Belanja Pegawai % (lower is better), Infrastruktur % (higher is better), Pendidikan % (higher is better)
  - Kemandirian Fiskal (Rasio PAD %)
  - BPS IPM, Tingkat Kemiskinan (lower is better), TPT (lower is better)
  - Indeks Efektivitas Uang Rakyat + Radar / Grouped Bar comparison chart
- Generates an automated **Verdict Banner** explaining which region manages public money more efficiently and why.

---

## 5. UI/UX Design System & Wireframes

Derived from `design-system/kawal-apbd/MASTER.md` (UI/UX Pro Max):
- **Aesthetic Direction:** Civic-Fintech Editorial Bento Grid — clean, precise, data-dense yet breathable, bold tabular typography (`Fira Code` headings/numbers + `Fira Sans` body), crisp 1px borders, high contrast (`>= 4.5:1`), zero emojis as UI icons (Lucide SVG exclusively).
- **Color Tokens:**
  - Light Mode: Canvas `#F8FAFC`, Card `#FFFFFF`, Primary Civic Blue `#1E40AF`, Secondary `#3B82F6`, Amber Accent `#D97706`, Foreground `#0F172A` / `#1E3A8A`.
  - Dark Mode: Canvas `#0B1120`, Card `#111827`, Primary `#60A5FA`, Accent `#F59E0B`, Border `#1E293B`, Foreground `#F8FAFC`.
  - Audit Status: Rapor Hijau `#059669`, Rapor Kuning `#D97706`, Rapor Merah `#DC2626`.

### Wireframe: Scrollytelling Hero & Bento Dashboard
```text
+-------------------------------------------------------------------------+
| [Logo: KAWAL APBD]   [Dashboard] [Peta 3D] [Struk Pajak] [Adu Daerah]  |
|                      [Search Daerah...]                 [Dark/Light]    |
+-------------------------------------------------------------------------+
|  SCROLLYTELLING HERO: "KE MANA PERGINYA 1 RUPIAH UANG RAKYAT?"          |
|  [Step 1: Rp 1.380 T APBD] -> [Step 2: Birokrasi vs Publik] -> [Step 3] |
|  [CTA: Mulai Audit Daerah]  [CTA: Cetak Struk Pajakmu]                  |
+-------------------------------------------------------------------------+
|  BENTO ROW 1: KPI STRIP (4 Cols)                                        |
|  +---------------+ +---------------+ +---------------+ +--------------+ |
|  | Total APBD    | | Skor UU HKPD  | | Bel. Pegawai  | | Indeks Efekt.| |
|  | Rp 81,7 T     | | 84.5 (HIJAU)  | | 24.8% (<=30%) | | 81.2 / 100   | |
|  +---------------+ +---------------+ +---------------+ +--------------+ |
+-------------------------------------------------------------------------+
|  BENTO ROW 2: 3D SPATIAL MAP (8 Cols)        | REGION AUDIT CARD (4 Col)|
|  +-----------------------------------------+ | +----------------------+ |
|  | MapLibre GL JS 3D Extruded Indonesia    | | | Selected: DKI Jakarta| |
|  | Height = APBD | Color = HKPD Score      | | | UU HKPD Thresholds   | |
|  | [3D View] [2D View] [Legend]            | | | AI Auditor Insights  | |
|  +-----------------------------------------+ | +----------------------+ |
+-------------------------------------------------------------------------+
|  BENTO ROW 3: SANKEY MONEY FLOW (7 Cols)     | BPS CORRELATION (5 Cols) |
|  +-----------------------------------------+ | +----------------------+ |
|  | PAD / TKD -> APBD -> Pegawai/Infra/Pend | | | Scatter: HKPD vs IPM | |
|  +-----------------------------------------+ | +----------------------+ |
+-------------------------------------------------------------------------+
|  BENTO ROW 4: VIRAL TOOLS TABS / SECTIONS                               |
|  [Struk Belanja Pajak PNG Generator]  |  [Adu Efisiensi Daerah 1v1]     |
+-------------------------------------------------------------------------+
|  BENTO ROW 5: FULL AUDIT LEADERBOARD TABLE (All 38 Prov + 14 Kab/Kota)  |
+-------------------------------------------------------------------------+
```
