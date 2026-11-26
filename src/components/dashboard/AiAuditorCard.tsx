"use client";

import * as React from "react";
import {
  FileSearch,
  Activity,
  Lightbulb,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { RegionRecord } from "@/types/apbd";

interface AiAuditorCardProps {
  region: RegionRecord;
}

export function AiAuditorCard({ region }: AiAuditorCardProps) {
  const { ai_audit, bps, effectiveness, provenance } = region;

  const insights = [
    {
      title: "Temuan Postur Fiskal (DJPK)",
      body: ai_audit.fiscal_finding,
      icon: FileSearch,
      tone: "text-foreground bg-secondary border-border",
    },
    {
      title: "Korelasi Indikator Sosial (BPS)",
      body: ai_audit.social_correlation,
      icon: Activity,
      tone: "text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/25",
    },
    {
      title: "Prioritas Pengawalan Publik",
      body: ai_audit.policy_recommendation,
      icon: Lightbulb,
      tone: "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
    },
  ];

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="border-b border-border pb-3.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Catatan Audit Berbasis Data Resmi</span>
            </div>
            <CardTitle className="mt-1 text-base">
              Ringkasan Investigasi: {region.name}
            </CardTitle>
            <CardDescription className="text-xs">
              Profil:{" "}
              <strong className="font-semibold text-foreground">
                {effectiveness.archetype}
              </strong>
            </CardDescription>
          </div>
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {ai_audit.audited_at}
          </span>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col justify-between space-y-4 pt-4">
        <div className="space-y-3">
          {insights.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="rounded-md border border-border bg-background/70 p-3"
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <span
                    className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border ${item.tone}`}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <h4 className="font-sans text-xs font-bold text-foreground">
                    {item.title}
                  </h4>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {item.body}
                </p>
              </div>
            );
          })}
        </div>

        {/* Official BPS Snapshot + Provenance Links */}
        <div className="space-y-2.5">
          <div className="grid grid-cols-3 gap-2 rounded-md border border-border bg-secondary/40 p-2.5 text-center">
            <div>
              <p className="font-mono text-[10px] uppercase text-muted-foreground">
                IPM ({bps.year})
              </p>
              <p className="font-mono text-sm font-bold text-foreground tabular-nums">
                {bps.ipm !== null ? bps.ipm : "—"}
              </p>
            </div>
            <div className="border-x border-border">
              <p className="font-mono text-[10px] uppercase text-muted-foreground">
                Kemiskinan
              </p>
              <p className="font-mono text-sm font-bold text-foreground tabular-nums">
                {bps.poverty_rate_pct !== null ? `${bps.poverty_rate_pct}%` : "—"}
              </p>
            </div>
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase text-muted-foreground">
                TPT BPS
              </p>
              {bps.tpt_pct !== null ? (
                <p className="font-mono text-sm font-bold text-foreground tabular-nums">
                  {bps.tpt_pct}%
                </p>
              ) : (
                <p
                  className="font-mono text-sm font-bold leading-tight text-muted-foreground"
                  title="Data TPT Kab/Kota belum dipublikasikan pada tabel provinsi BPS"
                >
                  —
                  <span className="mt-0.5 block truncate font-sans text-[9px] font-medium text-muted-foreground">
                    Belum Dipublikasikan
                  </span>
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] text-muted-foreground">
            <span>Sumber Terverifikasi:</span>
            <div className="flex items-center gap-3">
              <a
                href={provenance.djpk_source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-foreground underline-offset-4 hover:underline"
              >
                DJPK TA {provenance.fiscal_year}
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
              <a
                href={provenance.bps_source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-foreground underline-offset-4 hover:underline"
              >
                Tabel BPS RI
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
