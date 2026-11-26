"use client";

import * as React from "react";
import {
  Search,
  Map as MapIcon,
  BarChart3,
  Receipt,
  ArrowUpRight,
  CheckCircle2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NationalSummary, RegionRecord } from "@/types/apbd";
import {
  cn,
  formatMiliarToTriliun,
  formatNumberId,
  getGradeStyles,
} from "@/lib/utils";

interface ScrollytellingHeroProps {
  regions: RegionRecord[];
  summary: NationalSummary;
  onSelectRegion: (regionId: string) => void;
  onJumpTo: (sectionId: string) => void;
}

/**
 * Editorial Front-Page Fiscal Brief (Katadata / Tempo Data / Bloomberg inspired).
 * Zero graph-paper grid, zero gradient text spans, zero vanity developer metrics.
 */
export function ScrollytellingHero({
  regions,
  summary,
  onSelectRegion,
  onJumpTo,
}: ScrollytellingHeroProps) {
  const [query, setQuery] = React.useState("");
  const [openDropdown, setOpenDropdown] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const searchWrapRef = React.useRef<HTMLDivElement | null>(null);

  const indexedRegions = React.useMemo(
    () =>
      regions.map((r) => ({
        region: r,
        nameLower: r.name.toLowerCase(),
        provLower: (r.province_name ?? "").toLowerCase(),
        haystack: `${r.name} ${r.province_name ?? ""} ${r.island} ${r.bps_code} ${r.djpk_code}`.toLowerCase(),
      })),
    [regions]
  );

  const { matches, totalMatchCount } = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      const defaults = regions
        .filter((r) =>
          [
            "prov-31",
            "prov-32",
            "prov-35",
            "prov-64",
            "kota-3578",
            "kota-3273",
            "kab-5103",
            "prov-95",
          ].includes(r.id)
        )
        .slice(0, 8);
      return { matches: defaults, totalMatchCount: defaults.length };
    }
    const tokens = q.split(/\s+/).filter(Boolean);
    const hits: Array<{ region: RegionRecord; rank: number }> = [];
    for (const item of indexedRegions) {
      if (!tokens.every((t) => item.haystack.includes(t))) continue;
      let rank = 3;
      if (item.nameLower.startsWith(q)) rank = 0;
      else if (item.nameLower.includes(q)) rank = 1;
      else if (item.provLower.startsWith(q)) rank = item.region.level === "provinsi" ? 0 : 2;
      hits.push({ region: item.region, rank });
    }
    hits.sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      if (a.region.level === "provinsi" && b.region.level !== "provinsi") return -1;
      if (a.region.level !== "provinsi" && b.region.level === "provinsi") return 1;
      return a.region.name.localeCompare(b.region.name, "id");
    });
    return {
      matches: hits.slice(0, 12).map((h) => h.region),
      totalMatchCount: hits.length,
    };
  }, [regions, indexedRegions, query]);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  React.useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (
        searchWrapRef.current &&
        !searchWrapRef.current.contains(e.target as Node)
      ) {
        setOpenDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const handlePickRegion = (region: RegionRecord) => {
    onSelectRegion(region.id);
    setQuery(region.name);
    setOpenDropdown(false);
    onJumpTo("dashboard");
  };

  const kabKotaTotal = summary.total_kab_kota ?? summary.total_kab_kota_samples;
  const totalGrades = Math.max(1, summary.total_regions);
  const hijauPct = (summary.grade_distribution.hijau / totalGrades) * 100;
  const kuningPct = (summary.grade_distribution.kuning / totalGrades) * 100;
  const merahPct = (summary.grade_distribution.merah / totalGrades) * 100;

  return (
    <section id="hero" className="border-b border-border bg-background">
      {/* Newspaper / Institutional Dateline Bar */}
      <div className="border-b border-border bg-secondary/45">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-1.5 px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
              <CheckCircle2
                className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"
                aria-hidden="true"
              />
              DATA RESMI TERVERIFIKASI
            </span>
            <span aria-hidden="true">•</span>
            <span>APBD TA {summary.fiscal_year} (DJPK KEMENKEU RI)</span>
            <span className="hidden md:inline" aria-hidden="true">
              •
            </span>
            <span className="hidden md:inline">
              INDIKATOR SOSIAL BPS RI ({summary.bps_year})
            </span>
          </div>
          <span className="tabular-nums text-foreground/80">
            {summary.total_provinces} Provinsi + {kabKotaTotal} Kab/Kota Otonom
          </span>
        </div>
      </div>

      {/* Main Front-Page Broadsheet Grid */}
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="grid items-start gap-10 lg:grid-cols-12 lg:gap-12">
          {/* Left 7 Columns — Editorial Headline, Deck & Prominent Search */}
          <div className="space-y-6 lg:col-span-7">
            <div className="space-y-3">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400">
                Laporan Fiskal Daerah Indonesia • Tahun Anggaran{" "}
                {summary.fiscal_year}
              </p>

              <h1 className="font-sans text-3xl font-extrabold leading-[1.12] tracking-tight text-foreground sm:text-4xl lg:text-[2.75rem]">
                Mengawal{" "}
                <span className="font-mono tabular-nums underline decoration-emerald-600/70 decoration-2 underline-offset-4 dark:decoration-emerald-400/70">
                  Rp {formatNumberId(summary.total_apbd_triliun, 2)} Triliun
                </span>{" "}
                Anggaran Daerah Indonesia.
              </h1>

              <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-[1.0625rem]">
                Audit terbuka postur belanja, realisasi penyerapan, dan
                kepatuhan plafon belanja pegawai UU HKPD di seluruh{" "}
                <strong className="font-semibold text-foreground">
                  {summary.total_provinces} provinsi
                </strong>{" "}
                serta{" "}
                <strong className="font-semibold text-foreground">
                  {kabKotaTotal} kabupaten/kota otonom
                </strong>{" "}
                ({summary.total_regions} Pemda), dipadukan langsung dengan data
                IPM, kemiskinan, dan pengangguran resmi{" "}
                <strong className="font-semibold text-foreground">
                  BPS RI
                </strong>
                .
              </p>
            </div>

            {/* Prominent Citizen Quick-Search Bar */}
            <div ref={searchWrapRef} className="relative max-w-xl">
              <label htmlFor="hero-region-search" className="sr-only">
                Cari Provinsi atau Kabupaten/Kota untuk diaudit
              </label>
              <div className="relative flex items-center">
                <Search
                  className="pointer-events-none absolute left-3.5 h-4 w-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  id="hero-region-search"
                  type="text"
                  autoComplete="off"
                  placeholder="Cari nama Kabupaten, Kota, atau Provinsi... (mis. Banyuwangi, Jawa Barat, Mimika)"
                  value={query}
                  onFocus={() => setOpenDropdown(true)}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setOpenDropdown(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setOpenDropdown(true);
                      setActiveIndex((prev) =>
                        matches.length > 0 ? Math.min(matches.length - 1, prev + 1) : 0
                      );
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setActiveIndex((prev) => Math.max(0, prev - 1));
                    } else if (e.key === "Enter" && matches[activeIndex]) {
                      e.preventDefault();
                      handlePickRegion(matches[activeIndex]);
                    } else if (e.key === "Escape") {
                      setOpenDropdown(false);
                    }
                  }}
                  className="h-12 w-full rounded-md border border-input bg-card pl-10 pr-10 text-sm text-foreground shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setOpenDropdown(false);
                    }}
                    aria-label="Hapus pencarian"
                    className="absolute right-3 rounded p-1 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>

              {openDropdown && (
                <div
                  role="listbox"
                  aria-label="Hasil pencarian daerah"
                  className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-80 overflow-y-auto rounded-md border border-border bg-popover shadow-lg"
                >
                  <div className="flex items-center justify-between border-b border-border px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <span>
                      {query.trim()
                        ? totalMatchCount > matches.length
                          ? `Menampilkan ${matches.length} dari ${totalMatchCount} Entitas`
                          : `${totalMatchCount} Entitas Ditemukan`
                        : "Sorotan Daerah Cepat"}
                    </span>
                    <span className="hidden sm:inline">↑↓ Navigasi • Enter Pilih</span>
                  </div>
                  {matches.length === 0 ? (
                    <div className="space-y-2 px-3.5 py-3 text-xs text-muted-foreground">
                      <p>
                        Tidak ditemukan daerah untuk &ldquo;{query}&rdquo;. Coba nama
                        provinsi atau kota seperti{" "}
                        <button
                          type="button"
                          onClick={() => setQuery("Jawa Timur")}
                          className="font-semibold text-foreground underline underline-offset-2"
                        >
                          Jawa Timur
                        </button>
                        ,{" "}
                        <button
                          type="button"
                          onClick={() => setQuery("Aceh")}
                          className="font-semibold text-foreground underline underline-offset-2"
                        >
                          Aceh
                        </button>
                        , atau{" "}
                        <button
                          type="button"
                          onClick={() => setQuery("Surabaya")}
                          className="font-semibold text-foreground underline underline-offset-2"
                        >
                          Surabaya
                        </button>
                        .
                      </p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-border/70">
                      {matches.map((r, idx) => {
                        const gs = getGradeStyles(r.hkpd.grade);
                        const isHighlighted = idx === activeIndex;
                        return (
                          <li key={r.id}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={isHighlighted}
                              onMouseEnter={() => setActiveIndex(idx)}
                              onClick={() => handlePickRegion(r)}
                              className={cn(
                                "flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors",
                                isHighlighted ? "bg-muted" : "hover:bg-muted/70"
                              )}
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-foreground">
                                  {r.name}
                                </p>
                                <p className="truncate font-mono text-[11px] text-muted-foreground">
                                  {r.level === "provinsi"
                                    ? `Provinsi • ${r.island}`
                                    : `${r.province_name} • Kode ${r.bps_code}`}{" "}
                                  • Pegawai {r.expenditure.pegawai_pct}%
                                </p>
                              </div>
                              <div className="shrink-0 text-right font-mono">
                                <span className="block text-xs font-semibold text-foreground tabular-nums">
                                  {formatMiliarToTriliun(
                                    r.expenditure.total_belanja_miliar
                                  )}
                                </span>
                                <span
                                  className={cn(
                                    "text-[10px] font-semibold uppercase",
                                    gs.textClass
                                  )}
                                >
                                  Skor {r.hkpd.score} ({gs.shortLabel})
                                </span>
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Direct Entry Actions */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button
                type="button"
                size="lg"
                onClick={() => onJumpTo("peta-3d")}
                className="font-sans text-sm font-semibold"
              >
                <MapIcon className="h-4 w-4" aria-hidden="true" />
                Eksplorasi Peta 3D Nusantara
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => onJumpTo("dashboard")}
                className="font-sans text-sm font-semibold"
              >
                <BarChart3 className="h-4 w-4" aria-hidden="true" />
                Masuk Dashboard Audit
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={() => onJumpTo("struk-pajak")}
                className="font-sans text-sm font-semibold text-muted-foreground hover:text-foreground"
              >
                <Receipt className="h-4 w-4" aria-hidden="true" />
                Simulasi Struk Pajak
              </Button>
            </div>
          </div>

          {/* Right 5 Columns — Institutional Front-Page Fiscal Ledger */}
          <div className="lg:col-span-5">
            <aside
              aria-label="Ikhtisar Fiskal Nasional TA 2025"
              className="overflow-hidden rounded-lg border border-border bg-card"
            >
              {/* Ledger Masthead */}
              <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-5 py-3">
                <div>
                  <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
                    Ikhtisar Fiskal Nasional
                  </h2>
                  <p className="text-[11px] text-muted-foreground">
                    Agregasi Realisasi &amp; Postur DJPK TA {summary.fiscal_year}
                  </p>
                </div>
                <a
                  href="https://djpk.kemenkeu.go.id/portal/data/apbd"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-foreground underline-offset-4 hover:underline"
                >
                  DJPK RI
                  <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                </a>
              </div>

              {/* 2x2 Hairline Statistical Grid */}
              <div className="grid grid-cols-2 divide-x divide-y divide-border">
                <div className="p-4">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    APBD Nasional ({summary.total_regions} Pemda)
                  </p>
                  <p className="mt-1.5 font-mono text-xl font-bold tracking-tight text-foreground tabular-nums sm:text-2xl">
                    Rp {formatNumberId(summary.total_apbd_triliun, 2)} T
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground tabular-nums">
                    Prov: Rp {formatNumberId(summary.total_provinsi_apbd_triliun, 1)} T • Kab/Kota: Rp{" "}
                    {formatNumberId(
                      summary.total_kab_kota_apbd_triliun ??
                        Math.max(0, summary.total_apbd_triliun - summary.total_provinsi_apbd_triliun),
                      1
                    )}{" "}
                    T
                  </p>
                </div>

                <div className="p-4">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Rata-Rata Serapan
                  </p>
                  <p className="mt-1.5 font-mono text-xl font-bold tracking-tight text-emerald-700 dark:text-emerald-400 tabular-nums sm:text-2xl">
                    {formatNumberId(summary.avg_serapan_pct, 1)}%
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground tabular-nums">
                    Realisasi: Rp {formatNumberId(summary.total_realisasi_triliun, 1)} T • PAD{" "}
                    {formatNumberId(summary.avg_pad_ratio_pct, 1)}%
                  </p>
                </div>

                <div className="p-4">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Belanja Pegawai
                  </p>
                  <p
                    className={cn(
                      "mt-1.5 font-mono text-xl font-bold tracking-tight tabular-nums sm:text-2xl",
                      summary.avg_pegawai_pct <= 30
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    )}
                  >
                    {formatNumberId(summary.avg_pegawai_pct, 1)}%
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    Plafon UU HKPD: maks. 30%
                  </p>
                </div>

                <div className="p-4">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Belanja Modal DJPK
                  </p>
                  <p className="mt-1.5 font-mono text-xl font-bold tracking-tight text-foreground tabular-nums sm:text-2xl">
                    {formatNumberId(summary.avg_modal_pct, 1)}%
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    Acuan Aset Publik: ≥ 15%
                  </p>
                </div>
              </div>

              {/* Semantic Rapor Distribution Strip */}
              <div className="border-t border-border px-5 py-3.5 space-y-2">
                <div className="flex items-center justify-between font-mono text-[11px]">
                  <span className="font-semibold uppercase tracking-wider text-muted-foreground">
                    Distribusi Rapor Fiskal
                  </span>
                  <span className="font-semibold text-foreground tabular-nums">
                    Skor Rerata {formatNumberId(summary.avg_hkpd_score, 1)}/100
                  </span>
                </div>
                <div
                  className="flex h-2.5 w-full overflow-hidden rounded-sm bg-muted"
                  role="img"
                  aria-label={`Distribusi rapor: ${summary.grade_distribution.hijau} Hijau, ${summary.grade_distribution.kuning} Kuning, ${summary.grade_distribution.merah} Merah`}
                >
                  <div
                    className="bg-emerald-600 dark:bg-emerald-500"
                    style={{ width: `${hijauPct}%` }}
                  />
                  <div
                    className="bg-amber-600 dark:bg-amber-500"
                    style={{ width: `${kuningPct}%` }}
                  />
                  <div
                    className="bg-red-600 dark:bg-red-500"
                    style={{ width: `${merahPct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between font-mono text-[11px] tabular-nums">
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                    {summary.grade_distribution.hijau} Hijau
                  </span>
                  <span className="font-semibold text-amber-700 dark:text-amber-400">
                    {summary.grade_distribution.kuning} Kuning
                  </span>
                  <span className="font-semibold text-red-700 dark:text-red-400">
                    {summary.grade_distribution.merah} Merah
                  </span>
                </div>
              </div>

              {/* Official BPS National Benchmarks Footer */}
              <div className="grid grid-cols-3 divide-x divide-border border-t border-border bg-muted/40 px-2 py-2.5 text-center font-mono">
                <div>
                  <span className="block text-[10px] uppercase text-muted-foreground">
                    IPM RI ({summary.bps_year})
                  </span>
                  <strong className="text-xs font-bold text-foreground tabular-nums">
                    {formatNumberId(summary.avg_ipm, 2)}
                  </strong>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-muted-foreground">
                    Kemiskinan RI
                  </span>
                  <strong className="text-xs font-bold text-foreground tabular-nums">
                    {formatNumberId(summary.avg_poverty_pct, 2)}%
                  </strong>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-muted-foreground">
                    TPT RI
                  </span>
                  <strong className="text-xs font-bold text-foreground tabular-nums">
                    {formatNumberId(summary.avg_tpt_pct, 2)}%
                  </strong>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}
