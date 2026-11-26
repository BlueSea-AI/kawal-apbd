"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
} from "recharts";
import { Crosshair } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { RegionRecord } from "@/types/apbd";
import { cn, formatMiliarToTriliun, getGradeStyles } from "@/lib/utils";

type ChartScope = "provinsi" | "semua";

interface BpsCorrelationChartProps {
  regions: RegionRecord[];
  selectedRegionId: string;
  fiscalYear?: number;
  onSelectRegion: (id: string) => void;
}

interface ScatterPoint {
  id: string;
  name: string;
  provinceName: string;
  x: number;
  y: number;
  z: number;
  grade: RegionRecord["hkpd"]["grade"];
  archetype: string;
  apbdMiliar: number;
  ipm: number | null;
  poverty: number | null;
}

export function BpsCorrelationChart({
  regions,
  selectedRegionId,
  fiscalYear,
  onSelectRegion,
}: BpsCorrelationChartProps) {
  // Client mount guard prevents Recharts ResponsiveContainer SSR width(-1) dev warnings
  const [mounted, setMounted] = React.useState(false);
  const [scope, setScope] = React.useState<ChartScope>("provinsi");

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const activeFiscalYear = fiscalYear ?? regions[0]?.fiscal_year ?? 2026;

  const scopedRegions = React.useMemo(() => {
    // If user already filtered down to <= 80 regions (e.g., via search/filter bar), show all filtered directly
    if (scope === "semua" || regions.length <= 80) {
      return regions;
    }
    const provs = regions.filter((r) => r.level === "provinsi");
    const selected = regions.find((r) => r.id === selectedRegionId);
    if (selected && selected.level !== "provinsi") {
      return [...provs, selected];
    }
    return provs;
  }, [regions, scope, selectedRegionId]);

  const data: ScatterPoint[] = React.useMemo(
    () =>
      scopedRegions.map((r) => ({
        id: r.id,
        name: r.name,
        provinceName: r.province_name,
        x: r.hkpd.score,
        y: r.effectiveness.social_outcome_score,
        z: Math.max(
          30,
          Math.sqrt(Math.max(0, r.expenditure.total_belanja_miliar || 0)) * 2.8
        ),
        grade: r.hkpd.grade,
        archetype: r.effectiveness.archetype,
        apbdMiliar: r.expenditure.total_belanja_miliar,
        ipm: r.bps.ipm,
        poverty: r.bps.poverty_rate_pct,
      })),
    [scopedRegions]
  );

  const isDense = data.length > 80;

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="border-b border-border pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Crosshair
                className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400"
                aria-hidden="true"
              />
              <span>Korelasi Postur DJPK × Dampak Sosial BPS</span>
            </div>
            <CardTitle className="mt-1 text-base">
              Matriks Efektivitas Anggaran Daerah
            </CardTitle>
            <CardDescription className="text-xs">
              Sumbu X: Skor Audit Fiskal DJPK • Sumbu Y: Skor Dampak Sosial BPS
              (IPM, Kemiskinan, TPT). Klik titik untuk mengaudit daerah.
            </CardDescription>
          </div>

          {regions.length > 80 && (
            <div className="flex shrink-0 items-center gap-1 rounded-md border border-border bg-secondary/50 p-0.5 font-mono text-[11px]">
              <button
                type="button"
                onClick={() => setScope("provinsi")}
                className={cn(
                  "rounded px-2.5 py-1 font-semibold transition-colors",
                  scope === "provinsi"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                38 Provinsi
              </button>
              <button
                type="button"
                onClick={() => setScope("semua")}
                className={cn(
                  "rounded px-2.5 py-1 font-semibold transition-colors tabular-nums",
                  scope === "semua"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Semua ({regions.length})
              </button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col justify-between pt-4">
        <div className="h-[300px] w-full">
          {mounted ? (
            <ResponsiveContainer width="100%" height={300} minWidth={0}>
              <ScatterChart margin={{ top: 14, right: 16, bottom: 20, left: -8 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="currentColor"
                  className="text-border"
                />
                <XAxis
                  type="number"
                  dataKey="x"
                  domain={[25, 102]}
                  name="Skor Audit Fiskal"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  label={{
                    value: "Skor Audit Fiskal (DJPK) →",
                    position: "insideBottom",
                    offset: -12,
                    style: {
                      fontSize: 11,
                      fill: "var(--muted-foreground)",
                      fontFamily: "var(--font-jetbrains-mono)",
                    },
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  domain={[5, 98]}
                  name="Dampak Sosial BPS"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                />
                <ZAxis type="number" dataKey="z" range={isDense ? [20, 180] : [45, 360]} />
                <ReferenceLine
                  x={75}
                  stroke="var(--rapor-hijau)"
                  strokeDasharray="4 4"
                  strokeOpacity={0.55}
                />
                <ReferenceLine
                  y={65}
                  stroke="var(--rapor-kuning)"
                  strokeDasharray="4 4"
                  strokeOpacity={0.55}
                />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const pt = payload[0].payload as ScatterPoint;
                    return (
                      <div className="rounded-md border border-border bg-popover p-3 text-xs shadow-lg">
                        <p className="font-sans font-bold text-foreground">
                          {pt.name}
                        </p>
                        <p className="mt-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                          {pt.archetype}
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground tabular-nums">
                          <span>Audit Fiskal: {pt.x}</span>
                          <span>Sosial BPS: {pt.y}</span>
                          <span>IPM: {pt.ipm !== null ? pt.ipm : "—"}</span>
                          <span>
                            Miskin: {pt.poverty !== null ? `${pt.poverty}%` : "—"}
                          </span>
                        </div>
                        <p className="mt-1.5 font-mono text-[11px] font-semibold text-foreground tabular-nums">
                          APBD: {formatMiliarToTriliun(pt.apbdMiliar)}
                        </p>
                      </div>
                    );
                  }}
                />
                <Scatter
                  data={data}
                  isAnimationActive={false}
                  onClick={(entry) => {
                    if (entry && entry.id) {
                      onSelectRegion(entry.id);
                    }
                  }}
                  className="cursor-pointer"
                >
                  {data.map((entry) => {
                    const isSelected = entry.id === selectedRegionId;
                    const color = getGradeStyles(entry.grade).hex;
                    return (
                      <Cell
                        key={entry.id}
                        fill={color}
                        fillOpacity={isSelected ? 1 : isDense ? 0.52 : 0.72}
                        stroke={isSelected ? "var(--foreground)" : "#ffffff"}
                        strokeWidth={isSelected ? 2.5 : isDense ? 0.5 : 1}
                      />
                    );
                  })}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[300px] w-full items-center justify-center rounded-md bg-muted/40 font-mono text-xs text-muted-foreground">
              Memuat matriks korelasi BPS...
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2.5 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3 font-mono">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
              Rapor Hijau
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-600" />
              Kuning
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-600" />
              Merah
            </span>
          </div>
          <span className="font-mono">
            Ukuran gelembung = Total APBD TA {activeFiscalYear}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
