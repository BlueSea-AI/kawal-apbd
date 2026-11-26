"use client";

import * as React from "react";
import {
  Scale,
  CheckCircle2,
  XCircle,
  Building2,
  GraduationCap,
  Users,
  Landmark,
  Activity,
  Info,
  ExternalLink,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { RegionRecord } from "@/types/apbd";
import { cn, getGradeStyles } from "@/lib/utils";

interface HkpdComplianceCardProps {
  region: RegionRecord;
}

export function HkpdComplianceCard({ region }: HkpdComplianceCardProps) {
  const { hkpd, expenditure, revenue, provenance } = region;
  const gradeStyle = getGradeStyles(hkpd.grade);

  const isFullHkpdInfra = hkpd.infra_basis === "uu_hkpd_40";

  const verifiedMetrics = [
    {
      id: "pegawai",
      label: "Belanja Pegawai (UU HKPD Pasal 146)",
      ruleLabel: "Plafon Maks. 30% dari Total Belanja",
      actual: expenditure.pegawai_pct,
      threshold: 30,
      maxScale: 55,
      compliant: hkpd.pegawai_compliant,
      points: hkpd.pegawai_points,
      maxPoints: 40,
      icon: Users,
    },
    {
      id: "modal",
      label: isFullHkpdInfra
        ? "Infrastruktur Pelayanan Publik (UU HKPD)"
        : "Belanja Modal / Aset Publik (DJPK)",
      ruleLabel: isFullHkpdInfra
        ? "Target Min. 40% (UU HKPD Pasal 147)"
        : "Acuan Belanja Modal Daerah Min. 15%",
      actual: isFullHkpdInfra
        ? (expenditure.infrastruktur_hkpd_pct ?? expenditure.modal_pct)
        : expenditure.modal_pct,
      threshold: isFullHkpdInfra ? 40 : 15,
      maxScale: isFullHkpdInfra ? 60 : 40,
      compliant: hkpd.infrastruktur_compliant === true,
      points: hkpd.infrastruktur_points,
      maxPoints: 35,
      icon: Building2,
    },
    ...(expenditure.pendidikan_pct !== null && hkpd.pendidikan_points !== null
      ? [
          {
            id: "pendidikan",
            label: "Fungsi Pendidikan (Mandatory Spending)",
            ruleLabel: "Wajib Min. 20% APBD",
            actual: expenditure.pendidikan_pct,
            threshold: 20,
            maxScale: 40,
            compliant: hkpd.pendidikan_compliant === true,
            points: hkpd.pendidikan_points,
            maxPoints: 25,
            icon: GraduationCap,
          },
        ]
      : [
          {
            id: "serapan",
            label: "Realisasi Penyerapan Belanja (DJPK)",
            ruleLabel: "Target Eksekusi Anggaran Min. 85%",
            actual: expenditure.serapan_belanja_pct,
            threshold: 85,
            maxScale: 105,
            compliant: expenditure.serapan_belanja_pct >= 85,
            points: hkpd.serapan_points ?? 0,
            maxPoints: 25,
            icon: Activity,
          },
        ]),
  ];

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="border-b border-border pb-3.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Scale
                className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400"
                aria-hidden="true"
              />
              <span>Audit Postur &amp; UU HKPD TA {region.fiscal_year}</span>
            </div>
            <CardTitle className="mt-1 text-lg">{region.name}</CardTitle>
            <CardDescription className="text-xs">
              {region.level === "provinsi"
                ? `Pemerintah Provinsi • ${region.island}`
                : `${region.level === "kota" ? "Pemerintah Kota" : "Pemerintah Kabupaten"} • ${region.province_name}`}{" "}
              • Kode BPS {region.bps_code}
            </CardDescription>
          </div>
          <Badge variant={hkpd.grade} className="shrink-0 font-mono text-xs tabular-nums">
            {hkpd.score} / 100
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col justify-between space-y-4 pt-4">
        <div className="space-y-4">
          {verifiedMetrics.map((m) => {
            const Icon = m.icon;
            const fillPct = Math.min(100, (m.actual / m.maxScale) * 100);
            const markerPct = Math.min(100, (m.threshold / m.maxScale) * 100);

            return (
              <div key={m.id} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-foreground">
                    <Icon
                      className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span>{m.label}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 font-mono tabular-nums">
                    <span
                      className={cn(
                        "font-bold",
                        m.compliant
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                      )}
                    >
                      {m.actual}%
                    </span>
                    {m.compliant ? (
                      <CheckCircle2
                        className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"
                        aria-label="Memenuhi acuan"
                      />
                    ) : (
                      <XCircle
                        className="h-3.5 w-3.5 text-red-600 dark:text-red-400"
                        aria-label="Belum memenuhi acuan"
                      />
                    )}
                  </div>
                </div>

                {/* Progress bar with threshold needle */}
                <div className="relative h-2 w-full overflow-hidden rounded-sm bg-muted">
                  <div
                    className={cn(
                      "h-full transition-all duration-300",
                      m.compliant
                        ? "bg-emerald-600 dark:bg-emerald-500"
                        : "bg-red-600 dark:bg-red-500"
                    )}
                    style={{ width: `${fillPct}%` }}
                  />
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-foreground"
                    style={{ left: `${markerPct}%` }}
                    title={`Ambang batas ${m.threshold}%`}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{m.ruleLabel}</span>
                  <span className="font-mono tabular-nums">
                    {m.points}/{m.maxPoints} poin
                  </span>
                </div>
              </div>
            );
          })}

          {/* Explicit Transparency Callout for Unpublished Official Functional Accounts */}
          {expenditure.pendidikan_pct === null && (
            <div className="rounded-md border border-border bg-muted/50 p-3 text-[11px] leading-relaxed text-muted-foreground">
              <div className="flex items-center gap-1.5 font-mono font-semibold uppercase tracking-wide text-foreground">
                <Info className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                <span>Fungsi Pendidikan &amp; Kesehatan: Data Belum Dipublikasikan Resmi</span>
              </div>
              <p className="mt-1">
                Endpoint terbuka DJPK (<code>csv_apbd</code>) merilis Klasifikasi
                Ekonomi, bukan Klasifikasi Fungsi. Kawal APBD menampilkan{" "}
                <strong className="text-foreground">null</strong> tanpa estimasi
                fiktif hingga file resmi diunggah ke <code>data/raw/</code>.
              </p>
            </div>
          )}
        </div>

        {/* Fiscal Independence Footer + Live DJPK Verification Link */}
        <div className="space-y-3 rounded-md border border-border bg-secondary/40 p-3.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-semibold text-foreground">
              <Landmark className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              Kemandirian Fiskal (PAD vs TKD)
            </span>
            <span className={cn("font-mono text-xs font-bold", gradeStyle.textClass)}>
              {gradeStyle.label}
            </span>
          </div>
          <div className="flex h-2 w-full overflow-hidden rounded-sm bg-background">
            <div
              className="bg-emerald-600 transition-all duration-300"
              style={{ width: `${Math.min(100, revenue.pad_ratio_pct)}%` }}
              title={`PAD ${revenue.pad_ratio_pct}%`}
            />
            <div
              className="bg-slate-400 dark:bg-slate-500 transition-all duration-300"
              style={{ width: `${Math.min(100, revenue.tkd_ratio_pct)}%` }}
              title={`Transfer Pusat (TKD) ${revenue.tkd_ratio_pct}%`}
            />
          </div>
          <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground tabular-nums">
            <span>PAD: {revenue.pad_ratio_pct}%</span>
            <span>TKD Pusat: {revenue.tkd_ratio_pct}%</span>
          </div>
          <div className="flex items-center justify-between border-t border-border/80 pt-2 font-mono text-[10px]">
            <span className="text-muted-foreground">
              Kode DJPK: {region.djpk_code}
            </span>
            <a
              href={provenance.djpk_source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-foreground underline-offset-4 hover:underline"
            >
              Verifikasi XML DJPK
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
