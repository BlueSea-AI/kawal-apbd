# Execution Plan — Kawal APBD

Granular, atomic engineering roadmap. Each task is small, independently verifiable, and immediately checkpointed in `docs/PROGRESS.md`.

---

## Phase 0 — Autonomous Documentation & State Setup
- **0.1** Inspect environment, load installed UI/UX Pro Max & Superpowers skills, generate design system tokens (`design-system/kawal-apbd/MASTER.md`).
- **0.2** Author `docs/PRD.md`.
- **0.3** Author `docs/TECH_SPEC.md`.
- **0.4** Author `docs/EXECUTION_PLAN.md`.
- **0.5** Initialize `docs/PROGRESS.md`.

## Phase 1 — Project Init & Design System
- **1.1** Scaffold Next.js App Router + TypeScript + Tailwind CSS v4 project cleanly in workspace root (`package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`).
- **1.2** Install core dependencies (`lucide-react`, `clsx`, `tailwind-merge`, `class-variance-authority`, `next-themes`, `recharts`, `maplibre-gl`, `gsap`, `framer-motion`, `html-to-image`).
- **1.3** Configure semantic design tokens (`src/app/globals.css`), `Fira Code` + `Fira Sans` fonts (`src/app/layout.tsx`), and Dark/Light `ThemeProvider.tsx`.
- **1.4** Create TypeScript domain types (`src/types/apbd.ts`), formatters (`src/lib/utils.ts`), and shared UU HKPD / Receipt math helpers (`src/lib/audit-engine.ts`).
- **1.5** Build accessible Shadcn UI primitives (`src/components/ui/button.tsx`, `card.tsx`, `badge.tsx`, `input.tsx`, `tabs.tsx`, `table.tsx`, `select.tsx`, `separator.tsx`).
- **1.6** Verify Phase 1 compilation (`npx tsc --noEmit`).

## Phase 2 — Python ETL & Rich 38-Province Seed Dataset
- **2.1** Create `scripts/requirements.txt` and `scripts/etl_pipeline.py` with DJPK/BPS live-fetch adapters, deterministic 38-province + 14-Kab/Kota dataset builder, UU HKPD audit calculator, BPS Effectiveness Index calculator, pre-computed civic audit insights, and 38-province GeoJSON generator.
- **2.2** Create `scripts/generate_ai_audits.py` batch Gemini API template script with `--dry-run` support.
- **2.3** Run `python scripts/etl_pipeline.py --verify` to generate and validate `public/data/regions.json`, `public/data/national_summary.json`, and `public/data/indonesia_provinces.geojson`.
- **2.4** Create server-side data loader (`src/lib/data-loader.ts`) and verify schema integrity.

## Phase 3 — Core Bento Dashboard & Sankey Money Flow
- **3.1** Build `src/components/layout/Navbar.tsx` (sticky glass header, section jump links, dark/light toggle) and `Footer.tsx` (DJPK/BPS attribution & methodology notes).
- **3.2** Build `src/components/dashboard/KpiBentoStrip.tsx` with animated number counters (respecting `prefers-reduced-motion`).
- **3.3** Build `src/components/dashboard/RegionFilterBar.tsx` (search, level filter, island cluster filter, rapor grade filter, quick selector).
- **3.4** Build `src/components/dashboard/HkpdComplianceCard.tsx` (UU No. 1/2022 gauges, threshold markers, compliance pass/fail badges) and `AiAuditorCard.tsx` (3-point pre-computed AI audit insights).
- **3.5** Build `src/components/dashboard/SankeyMoneyFlow.tsx` (interactive responsive SVG Sankey from PAD/TKD -> APBD -> Expenditure posts + hover tooltip + accessible table toggle).
- **3.6** Build `src/components/dashboard/BpsCorrelationChart.tsx` (Recharts interactive scatter plot correlating UU HKPD Score vs. BPS Social Outcome Score) and `RegionLeaderboardTable.tsx` (sortable full-region Shadcn table).

## Phase 4 — 3D Spatial Map & Scrollytelling Hero
- **4.1** Build `src/components/map/SpatialMap3D.tsx` using MapLibre GL JS with zero-token vector/GeoJSON 3D `fill-extrusion` layer (height = Total APBD, color = UU HKPD score), interactive hover card, click-to-select sync, 3D/2D camera toggles, and keyboard-accessible region list fallback.
- **4.2** Build `src/components/hero/ScrollytellingHero.tsx` using GSAP ScrollTrigger + Framer Motion explaining *"Ke Mana Perginya 1 Rupiah Anggaran Daerah?"* with interactive 3-step visual breakdown and reduced-motion support.

## Phase 5 — Viral Features: Struk Belanja Pajak PNG & Adu Efisiensi Daerah 1v1
- **5.1** Build `src/components/receipt/StrukBelanjaPajak.tsx` (thermal POS receipt aesthetic, live tax input + presets, exact Rupiah breakdown, UU HKPD stamp, crisp 2x PNG download via `html-to-image`, and copyable text summary).
- **5.2** Build `src/components/duel/AduEfisiensiDaerah.tsx` (1v1 Head-to-Head selector, curated quick duels, side-by-side fiscal + BPS metric battle bars, radar/bar comparison chart, and automated efficiency verdict).
- **5.3** Assemble complete experience in `src/components/dashboard/KawalApbdApp.tsx` and wire server-side data loading in `src/app/page.tsx`.

## Phase 6 — Build Audit, Quality Verification & Optimization
- **6.1** Run full TypeScript check (`npx tsc --noEmit`), ESLint (`npm run lint`), and production build (`npm run build`).
- **6.2** Write & run automated verification tests for the UU HKPD scoring formulas, BPS Effectiveness Index, and Receipt tax breakdown (`scripts/verify_audit_math.mjs` or Node test runner).
- **6.3** Start local dev/prod server and inspect rendered pages & responsiveness (desktop + mobile) to confirm zero runtime console errors, zero hydration mismatches, and crisp visuals.
- **6.4** Final update of `docs/PROGRESS.md` with complete verification evidence.
