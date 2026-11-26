"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Swords, Trophy, ArrowLeftRight, Scale } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RegionCombobox } from "@/components/ui/region-combobox";
import type { RegionRecord } from "@/types/apbd";
import { cn, formatMiliarToTriliun, getGradeStyles } from "@/lib/utils";

const CURATED_DUELS = [
  { label: "Jakarta vs Yogyakarta", a: "prov-31", b: "prov-34" },
  { label: "Surabaya vs Bandung", a: "kota-3578", b: "kota-3273" },
  { label: "Kaltim vs Papua Pegunungan", a: "prov-64", b: "prov-95" },
  { label: "Kab. Badung vs Maluku", a: "kab-5103", b: "prov-81" },
];

interface AduEfisiensiDaerahProps {
  regions: RegionRecord[];
  defaultRegionAId?: string;
}

export function AduEfisiensiDaerah({
  regions,
  defaultRegionAId = "prov-31",
}: AduEfisiensiDaerahProps) {
  const [mounted, setMounted] = React.useState(false);
  const [regionAId, setRegionAId] = React.useState(defaultRegionAId);
  const [regionBId, setRegionBId] = React.useState("prov-34");

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const regionA = regions.find((r) => r.id === regionAId) ?? regions[0];
  const regionB =
    regions.find((r) => r.id === regionBId) ??
    regions[Math.min(1, regions.length - 1)];

  const swapRegions = () => {
    setRegionAId(regionB.id);
    setRegionBId(regionA.id);
  };

  const comparisons = React.useMemo(
    () => [
      {
        label: "Skor Audit Fiskal (DJPK)",
        valA: regionA.hkpd.score,
        valB: regionB.hkpd.score,
        fmtA: `${regionA.hkpd.score} / 100`,
        fmtB: `${regionB.hkpd.score} / 100`,
        higherWins: true,
        max: 100,
      },
      {
        label: "Belanja Pegawai (Lebih Rendah Lebih Baik)",
        valA: regionA.expenditure.pegawai_pct,
        valB: regionB.expenditure.pegawai_pct,
        fmtA: `${regionA.expenditure.pegawai_pct}%`,
        fmtB: `${regionB.expenditure.pegawai_pct}%`,
        higherWins: false,
        max: 55,
      },
      {
        label: "Belanja Modal / Aset Publik (DJPK)",
        valA: regionA.expenditure.modal_pct,
        valB: regionB.expenditure.modal_pct,
        fmtA: `${regionA.expenditure.modal_pct}%`,
        fmtB: `${regionB.expenditure.modal_pct}%`,
        higherWins: true,
        max: 45,
      },
      {
        label: "Realisasi Penyerapan Belanja",
        valA: regionA.expenditure.serapan_belanja_pct,
        valB: regionB.expenditure.serapan_belanja_pct,
        fmtA: `${regionA.expenditure.serapan_belanja_pct}%`,
        fmtB: `${regionB.expenditure.serapan_belanja_pct}%`,
        higherWins: true,
        max: 110,
      },
      {
        label: "Kemandirian Fiskal (Rasio PAD)",
        valA: regionA.revenue.pad_ratio_pct,
        valB: regionB.revenue.pad_ratio_pct,
        fmtA: `${regionA.revenue.pad_ratio_pct}%`,
        fmtB: `${regionB.revenue.pad_ratio_pct}%`,
        higherWins: true,
        max: 100,
      },
      {
        label: "Indeks Pembangunan Manusia (IPM BPS)",
        valA: regionA.bps.ipm ?? 0,
        valB: regionB.bps.ipm ?? 0,
        fmtA: regionA.bps.ipm !== null ? `${regionA.bps.ipm}` : "N/A",
        fmtB: regionB.bps.ipm !== null ? `${regionB.bps.ipm}` : "N/A",
        higherWins: true,
        max: 100,
      },
      {
        label: "Tingkat Kemiskinan BPS (Lebih Rendah Lebih Baik)",
        valA: regionA.bps.poverty_rate_pct ?? 0,
        valB: regionB.bps.poverty_rate_pct ?? 0,
        fmtA:
          regionA.bps.poverty_rate_pct !== null
            ? `${regionA.bps.poverty_rate_pct}%`
            : "N/A",
        fmtB:
          regionB.bps.poverty_rate_pct !== null
            ? `${regionB.bps.poverty_rate_pct}%`
            : "N/A",
        higherWins: false,
        max: 36,
      },
    ],
    [regionA, regionB]
  );

  const winsA = comparisons.filter((c) =>
    c.higherWins ? c.valA > c.valB : c.valA < c.valB
  ).length;
  const winsB = comparisons.filter((c) =>
    c.higherWins ? c.valB > c.valA : c.valB < c.valA
  ).length;

  const overallWinner =
    regionA.effectiveness.effectiveness_score >
    regionB.effectiveness.effectiveness_score
      ? regionA
      : regionB.effectiveness.effectiveness_score >
        regionA.effectiveness.effectiveness_score
      ? regionB
      : null;

  // Use stable keys valA/valB so selecting the same region on both sides never collides in Recharts
  const chartData = [
    {
      metric: "Audit",
      valA: regionA.hkpd.score,
      valB: regionB.hkpd.score,
    },
    {
      metric: "Serapan",
      valA: Math.min(100, regionA.expenditure.serapan_belanja_pct),
      valB: Math.min(100, regionB.expenditure.serapan_belanja_pct),
    },
    {
      metric: "PAD",
      valA: regionA.revenue.pad_ratio_pct,
      valB: regionB.revenue.pad_ratio_pct,
    },
    {
      metric: "IPM",
      valA: regionA.bps.ipm ?? 0,
      valB: regionB.bps.ipm ?? 0,
    },
    {
      metric: "Efektiv.",
      valA: regionA.effectiveness.effectiveness_score,
      valB: regionB.effectiveness.effectiveness_score,
    },
  ];

  const renderSelect = (
    id: string,
    label: string,
    value: string,
    onChange: (v: string) => void,
    accentTone: "emerald" | "amber"
  ) => (
    <div className="flex-1 min-w-0">
      <label
        htmlFor={id}
        className="mb-1.5 block font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
      >
        {label}
      </label>
      <RegionCombobox
        id={id}
        regions={regions}
        value={value}
        onChange={onChange}
        accentTone={accentTone}
        placeholder="Cari kabupaten, kota, atau provinsi..."
        ariaLabel={label}
      />
    </div>
  );

  return (
    <section id="adu-daerah" className="scroll-mt-20">
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border bg-secondary/40">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Swords
                  className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400"
                  aria-hidden="true"
                />
                <span>Komparasi Kinerja 1v1 • Data DJPK &amp; BPS</span>
              </div>
              <CardTitle className="mt-1 text-xl">
                Adu Efisiensi Daerah
              </CardTitle>
              <CardDescription className="mt-1 text-sm">
                Bandingkan langsung postur belanja, serapan realisasi, dan
                capaian sosial BPS antara dua daerah secara objektif.
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {CURATED_DUELS.map((d) => (
                <button
                  key={d.label}
                  type="button"
                  onClick={() => {
                    setRegionAId(d.a);
                    setRegionBId(d.b);
                  }}
                  className="rounded-md border border-border bg-background px-2.5 py-1 font-mono text-[11px] text-foreground transition-colors hover:border-foreground"
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 p-5 sm:p-6">
          {/* Selectors Row */}
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end">
            {renderSelect(
              "duel-region-a",
              "Daerah A (Emerald)",
              regionA.id,
              setRegionAId,
              "emerald"
            )}
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={swapRegions}
              aria-label="Tukar posisi Daerah A dan Daerah B"
              className="h-11 w-11 shrink-0 self-center sm:self-end"
            >
              <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
            </Button>
            {renderSelect(
              "duel-region-b",
              "Daerah B (Amber)",
              regionB.id,
              setRegionBId,
              "amber"
            )}
          </div>

          {/* Tale of the Tape Cards (distinct sideKey avoids duplicate React keys when A===B) */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {[
              {
                sideKey: "side-a",
                reg: regionA,
                wins: winsA,
                accent: "border-emerald-600/35 bg-emerald-500/[0.03]",
                dot: "bg-emerald-600",
                winText: "text-emerald-700 dark:text-emerald-400",
              },
              {
                sideKey: "side-b",
                reg: regionB,
                wins: winsB,
                accent: "border-amber-600/35 bg-amber-500/[0.03]",
                dot: "bg-amber-600",
                winText: "text-amber-700 dark:text-amber-400",
              },
            ].map(({ sideKey, reg, wins, accent, dot, winText }) => {
              const isWinner = overallWinner?.id === reg.id;
              const gs = getGradeStyles(reg.hkpd.grade);
              return (
                <div
                  key={sideKey}
                  className={cn("space-y-2 rounded-lg border p-4", accent)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={cn("h-3 w-3 shrink-0 rounded-sm", dot)} />
                      <div>
                        <h3 className="flex items-center gap-1.5 font-sans text-base font-bold text-foreground">
                          {reg.name}
                          {isWinner && (
                            <Trophy
                              className="h-4 w-4 text-amber-600 dark:text-amber-400"
                              aria-label="Unggul Efektivitas"
                            />
                          )}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {reg.level !== "provinsi"
                            ? `${reg.province_name} • ${reg.effectiveness.archetype}`
                            : reg.effectiveness.archetype}
                        </p>
                      </div>
                    </div>
                    <Badge variant={reg.hkpd.grade} className="font-mono text-xs">
                      {gs.label}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 font-mono text-xs tabular-nums">
                    <div className="rounded border border-border bg-card p-2">
                      <span className="block text-[10px] text-muted-foreground">
                        APBD TA {reg.fiscal_year}
                      </span>
                      <strong className="text-foreground">
                        {formatMiliarToTriliun(reg.expenditure.total_belanja_miliar)}
                      </strong>
                    </div>
                    <div className="rounded border border-border bg-card p-2">
                      <span className="block text-[10px] text-muted-foreground">
                        SERAPAN
                      </span>
                      <strong className="text-foreground">
                        {reg.expenditure.serapan_belanja_pct}%
                      </strong>
                    </div>
                    <div className="rounded border border-border bg-card p-2">
                      <span className="block text-[10px] text-muted-foreground">
                        UNGGUL
                      </span>
                      <strong className={winText}>{wins} / 7</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Head-to-Head Metric Battle Bars + Chart */}
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="space-y-3 lg:col-span-7">
              {comparisons.map((c) => {
                const aWins = c.higherWins ? c.valA > c.valB : c.valA < c.valB;
                const bWins = c.higherWins ? c.valB > c.valA : c.valB < c.valA;
                const pctA = Math.min(100, (c.valA / c.max) * 100);
                const pctB = Math.min(100, (c.valB / c.max) * 100);

                return (
                  <div
                    key={c.label}
                    className="rounded-md border border-border bg-background/70 p-3"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                      <span
                        className={cn(
                          "font-mono tabular-nums",
                          aWins
                            ? "font-bold text-emerald-700 dark:text-emerald-400"
                            : "text-muted-foreground"
                        )}
                      >
                        {c.fmtA} {aWins ? "●" : ""}
                      </span>
                      <span className="text-center font-medium text-foreground">
                        {c.label}
                      </span>
                      <span
                        className={cn(
                          "font-mono tabular-nums",
                          bWins
                            ? "font-bold text-amber-700 dark:text-amber-400"
                            : "text-muted-foreground"
                        )}
                      >
                        {bWins ? "● " : ""}
                        {c.fmtB}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="flex h-2 justify-end overflow-hidden rounded-l-sm bg-muted">
                        <div
                          className="h-full bg-emerald-600 transition-all duration-300"
                          style={{ width: `${pctA}%` }}
                        />
                      </div>
                      <div className="flex h-2 justify-start overflow-hidden rounded-r-sm bg-muted">
                        <div
                          className="h-full bg-amber-600 transition-all duration-300"
                          style={{ width: `${pctB}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Grouped Bar Visual */}
            <div className="flex flex-col justify-between rounded-lg border border-border bg-card p-4 lg:col-span-5">
              <div>
                <h4 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Profil Perbandingan 5 Dimensi
                </h4>
                <div className="mt-3 h-[265px] w-full">
                  {mounted ? (
                    <ResponsiveContainer width="100%" height={265} minWidth={0}>
                      <BarChart
                        data={chartData}
                        margin={{ top: 8, right: 8, left: -16, bottom: 4 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="currentColor"
                          className="text-border"
                        />
                        <XAxis
                          dataKey="metric"
                          tick={{
                            fontSize: 10,
                            fill: "var(--muted-foreground)",
                          }}
                        />
                        <YAxis
                          domain={[0, 100]}
                          tick={{
                            fontSize: 10,
                            fill: "var(--muted-foreground)",
                          }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "var(--popover)",
                            borderColor: "var(--border)",
                            borderRadius: "6px",
                            fontSize: "12px",
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: "11px" }} />
                        <Bar
                          dataKey="valA"
                          name={regionA.name}
                          fill="#059669"
                          radius={[3, 3, 0, 0]}
                        />
                        <Bar
                          dataKey="valB"
                          name={regionB.name}
                          fill="#D97706"
                          radius={[3, 3, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-[265px] w-full items-center justify-center rounded-md bg-muted/40 font-mono text-xs text-muted-foreground">
                      Memuat grafik perbandingan...
                    </div>
                  )}
                </div>
              </div>

              {/* Verdict Banner */}
              <div className="mt-4 rounded-md border border-border bg-secondary/40 p-3 text-xs">
                <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-foreground">
                  <Scale className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                  <span>Kesimpulan Komparasi</span>
                </div>
                <p className="mt-1.5 leading-relaxed text-muted-foreground">
                  {overallWinner ? (
                    <>
                      <strong className="text-foreground">
                        {overallWinner.name}
                      </strong>{" "}
                      mencatat Indeks Efektivitas lebih tinggi (
                      <strong className="font-mono text-foreground tabular-nums">
                        {overallWinner.effectiveness.effectiveness_score}/100
                      </strong>
                      ) dengan belanja pegawai{" "}
                      <span className="font-mono tabular-nums">
                        {overallWinner.expenditure.pegawai_pct}%
                      </span>{" "}
                      dan IPM{" "}
                      <span className="font-mono tabular-nums">
                        {overallWinner.bps.ipm ?? "N/A"}
                      </span>
                      .
                    </>
                  ) : (
                    <>
                      Kedua daerah mencatat Indeks Efektivitas berimbang (
                      <strong className="font-mono text-foreground tabular-nums">
                        {regionA.effectiveness.effectiveness_score}/100
                      </strong>
                      ).
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
