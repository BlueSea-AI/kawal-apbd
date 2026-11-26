"use client";

import * as React from "react";
import {
  Wallet,
  Scale,
  Users,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { NationalSummary, RegionRecord } from "@/types/apbd";
import {
  cn,
  formatMiliarToTriliun,
  formatNumberId,
  formatRupiah,
  getGradeStyles,
} from "@/lib/utils";

interface KpiBentoStripProps {
  region: RegionRecord;
  summary: NationalSummary;
}

export function KpiBentoStrip({ region, summary }: KpiBentoStripProps) {
  const gradeStyle = getGradeStyles(region.hkpd.grade);
  const isTriliun = region.expenditure.total_belanja_miliar >= 1000;
  const apbdVal = isTriliun
    ? region.expenditure.total_belanja_miliar / 1000
    : region.expenditure.total_belanja_miliar;

  const GradeIcon =
    region.hkpd.grade === "hijau"
      ? CheckCircle2
      : region.hkpd.grade === "kuning"
      ? AlertTriangle
      : XCircle;

  const passedChecks = [
    region.hkpd.pegawai_compliant,
    region.hkpd.infrastruktur_compliant === true,
    region.hkpd.pendidikan_compliant !== null
      ? region.hkpd.pendidikan_compliant
      : region.expenditure.serapan_belanja_pct >= 85,
  ].filter(Boolean).length;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {/* KPI 1: Total Belanja APBD & Realisasi DJPK */}
      <Card className="border-border hover:border-foreground/30">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Belanja APBD TA {region.fiscal_year}
            </span>
            <Wallet className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </div>
          <div className="mt-2.5 font-mono text-2xl font-bold tracking-tight text-foreground tabular-nums sm:text-3xl">
            Rp {formatNumberId(apbdVal, isTriliun ? 2 : 0)}
            {isTriliun ? " T" : " M"}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-1 text-xs text-muted-foreground">
            <span>
              Serapan:{" "}
              <strong className="font-mono text-foreground tabular-nums">
                {region.expenditure.serapan_belanja_pct}%
              </strong>
            </span>
            <span className="font-mono text-[11px] tabular-nums">
              {region.bps.apbd_per_capita_idr
                ? formatRupiah(region.bps.apbd_per_capita_idr, true) + "/jiwa"
                : `PAD ${region.revenue.pad_ratio_pct}%`}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* KPI 2: Skor Audit Fiskal */}
      <Card className="border-border hover:border-foreground/30">
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Skor Audit Fiskal
            </span>
            <Badge variant={region.hkpd.grade} className="font-mono text-[10px]">
              <GradeIcon className="h-3 w-3" aria-hidden="true" />
              {gradeStyle.label}
            </Badge>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span
              className={cn(
                "font-mono text-2xl font-bold tracking-tight tabular-nums sm:text-3xl",
                gradeStyle.textClass
              )}
            >
              {formatNumberId(region.hkpd.score, 1)}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              / 100
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span className="tabular-nums">
              Rerata Nasional: {formatNumberId(summary.avg_hkpd_score, 1)}
            </span>
            <span className="font-mono text-[11px] tabular-nums">
              {passedChecks}/3 Pilar
            </span>
          </div>
        </CardContent>
      </Card>

      {/* KPI 3: Belanja Pegawai vs Non-Pegawai (Exact DJPK Economic Split) */}
      <Card className="border-border hover:border-foreground/30">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Belanja Pegawai
            </span>
            <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span
              className={cn(
                "font-mono text-2xl font-bold tracking-tight tabular-nums sm:text-3xl",
                region.hkpd.pegawai_compliant
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              )}
            >
              {formatNumberId(region.expenditure.pegawai_pct, 1)}%
            </span>
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              Modal {formatNumberId(region.expenditure.modal_pct, 1)}%
            </span>
          </div>
          <div
            className="mt-2.5 flex h-2 w-full overflow-hidden rounded-sm bg-muted"
            role="img"
            aria-label={`Belanja Pegawai ${region.expenditure.pegawai_pct} persen dibanding Belanja Non-Pegawai ${region.expenditure.publik_pct} persen`}
          >
            <div
              className={
                region.hkpd.pegawai_compliant
                  ? "bg-emerald-600 transition-all duration-300"
                  : "bg-red-600 transition-all duration-300"
              }
              style={{ width: `${Math.min(100, region.expenditure.pegawai_pct)}%` }}
            />
            <div
              className="bg-amber-600/80 transition-all duration-300"
              style={{
                width: `${Math.min(100, region.expenditure.barang_jasa_pct)}%`,
              }}
            />
            <div
              className="bg-slate-600 dark:bg-slate-400 transition-all duration-300"
              style={{ width: `${Math.min(100, region.expenditure.modal_pct)}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* KPI 4: Indeks Efektivitas & IPM BPS */}
      <Card className="border-border hover:border-foreground/30">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Indeks Efektivitas
            </span>
            <TrendingUp
              className="h-4 w-4 text-emerald-700 dark:text-emerald-400"
              aria-hidden="true"
            />
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold tracking-tight text-foreground tabular-nums sm:text-3xl">
              {formatNumberId(region.effectiveness.effectiveness_score, 1)}
            </span>
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              Peringkat #{region.effectiveness.rank_national}/
              {summary.total_regions}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-xs">
            <span className="truncate font-medium text-foreground">
              {region.effectiveness.archetype}
            </span>
            <span className="shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums">
              IPM {region.bps.ipm !== null ? region.bps.ipm : "N/A"}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function NationalQuickStats({ summary }: { summary: NationalSummary }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-xs">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-foreground">
          <Scale className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
          Rekap DJPK TA {summary.fiscal_year} ({summary.total_regions} Daerah)
        </span>
        <span className="text-border" aria-hidden="true">
          |
        </span>
        <span className="text-muted-foreground">
          Total Belanja:{" "}
          <strong className="font-mono text-foreground tabular-nums">
            {formatMiliarToTriliun(summary.total_apbd_triliun * 1000)}
          </strong>
        </span>
        <span className="text-muted-foreground">
          Realisasi:{" "}
          <strong className="font-mono text-foreground tabular-nums">
            {formatMiliarToTriliun(summary.total_realisasi_triliun * 1000)} (
            {summary.avg_serapan_pct}%)
          </strong>
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] tabular-nums">
        <Badge variant="hijau">{summary.grade_distribution.hijau} Hijau</Badge>
        <Badge variant="kuning">{summary.grade_distribution.kuning} Kuning</Badge>
        <Badge variant="merah">{summary.grade_distribution.merah} Merah</Badge>
      </div>
    </div>
  );
}
