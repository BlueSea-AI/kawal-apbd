"use client";

import * as React from "react";
import { GitBranch, Table as TableIcon, BarChart2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RegionRecord } from "@/types/apbd";
import { formatMiliarToTriliun } from "@/lib/utils";

interface SankeyNode {
  id: string;
  label: string;
  sublabel: string;
  value: number;
  pct: number;
  color: string;
  y: number;
  h: number;
}

interface SankeyMoneyFlowProps {
  region: RegionRecord;
}

export function SankeyMoneyFlow({ region }: SankeyMoneyFlowProps) {
  const [showTable, setShowTable] = React.useState(false);
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);

  const { revenue, expenditure } = region;

  const { leftNodes, centerNode, rightNodes, flows } = React.useMemo(() => {
    const svgHeight = 360;
    const padTop = 26;
    const usableH = svgHeight - padTop * 2;
    const gap = 11;

    const totalPend = Math.max(0.01, revenue.total_pendapatan_miliar);
    const rawLeft = [
      {
        id: "pad",
        label: "PAD (Pajak & Retribusi)",
        sublabel: "Kemandirian Fiskal",
        value: Math.max(0, revenue.pad_miliar),
        pct: revenue.pad_ratio_pct,
        color: "#059669",
      },
      {
        id: "tkd",
        label: "Transfer Pusat (TKD)",
        sublabel: "DAU, DAK, DBH",
        value: Math.max(0, revenue.tkd_miliar),
        pct: revenue.tkd_ratio_pct,
        color: "#334155",
      },
      {
        id: "lain-rev",
        label: "Pendapatan Lainnya",
        sublabel: "Hibah & Lain-lain Sah",
        value: Math.max(0, revenue.lain_lain_miliar),
        pct: Number(((revenue.lain_lain_miliar / totalPend) * 100).toFixed(1)),
        color: "#64748B",
      },
    ].filter((n) => n.value > 0);

    // 100% Exact Official DJPK APBD Economic Accounts (zero invented split ratios)
    const totalB = Math.max(0.01, expenditure.total_belanja_miliar);
    const rawRight = [
      {
        id: "pegawai",
        label: "Belanja Pegawai",
        sublabel: "Gaji & Tunjangan ASN",
        value: Math.max(0, expenditure.pegawai_miliar),
        pct: expenditure.pegawai_pct,
        color: "#DC2626",
      },
      {
        id: "barang-jasa",
        label: "Barang & Jasa",
        sublabel: "Operasional & Layanan",
        value: Math.max(0, expenditure.barang_jasa_miliar),
        pct: expenditure.barang_jasa_pct,
        color: "#D97706",
      },
      {
        id: "modal",
        label: "Belanja Modal",
        sublabel: "Jalan, Gedung, Aset Publik",
        value: Math.max(0, expenditure.modal_infrastruktur_miliar),
        pct: expenditure.modal_pct,
        color: "#059669",
      },
      {
        id: "hibah-bansos",
        label: "Hibah, Subsidi & Bansos",
        sublabel: "Dukungan Sosial & Publik",
        value: Math.max(0, expenditure.hibah_bansos_subsidi_miliar),
        pct: Number(
          ((expenditure.hibah_bansos_subsidi_miliar / totalB) * 100).toFixed(1)
        ),
        color: "#0F766E",
      },
      {
        id: "transfer-keluar",
        label: "Bagi Hasil & Bantuan Keu.",
        sublabel: "Transfer ke Kab/Kota & Desa",
        value: Math.max(0, expenditure.transfer_keluar_miliar),
        pct: Number(
          ((expenditure.transfer_keluar_miliar / totalB) * 100).toFixed(1)
        ),
        color: "#475569",
      },
      {
        id: "btt",
        label: "Belanja Tidak Terduga",
        sublabel: "Dana Darurat & Bencana",
        value: Math.max(0, expenditure.tidak_terduga_miliar),
        pct: Number(
          ((expenditure.tidak_terduga_miliar / totalB) * 100).toFixed(1)
        ),
        color: "#94A3B8",
      },
    ].filter((n) => n.value > 0);

    const layoutColumn = (
      items: typeof rawLeft,
      totalH: number
    ): SankeyNode[] => {
      const sum = items.reduce((a, b) => a + b.value, 0) || 1;
      const avail = totalH - gap * Math.max(0, items.length - 1);
      const minH = 15;
      const rawHeights = items.map((i) => Math.max(minH, (i.value / sum) * avail));
      const rawSum = rawHeights.reduce((a, b) => a + b, 0) || 1;
      const scale = avail / rawSum;

      let cursor = padTop;
      return items.map((item, idx) => {
        const h = rawHeights[idx] * scale;
        const node: SankeyNode = { ...item, y: cursor, h };
        cursor += h + gap;
        return node;
      });
    };

    const left = layoutColumn(rawLeft, usableH);
    const right = layoutColumn(rawRight, usableH);

    const centerH = usableH * 0.84;
    const centerY = padTop + (usableH - centerH) / 2;
    const center: SankeyNode = {
      id: "apbd",
      label: "KAS APBD",
      sublabel: region.name,
      value: totalB,
      pct: 100,
      color: "#0F172A",
      y: centerY,
      h: centerH,
    };

    const leftX1 = 196;
    const centerX0 = 335;
    const centerX1 = 385;
    const rightX0 = 524;

    const totalLeft = left.reduce((a, b) => a + b.value, 0) || 1;
    const totalRight = right.reduce((a, b) => a + b.value, 0) || 1;

    let leftCenterCursor = center.y;
    const leftFlows = left.map((n) => {
      const targetH = (n.value / totalLeft) * center.h;
      const y0Top = n.y;
      const y0Bot = n.y + n.h;
      const y1Top = leftCenterCursor;
      const y1Bot = leftCenterCursor + targetH;
      leftCenterCursor += targetH;
      const cx = (leftX1 + centerX0) / 2;
      const d = `M ${leftX1} ${y0Top} C ${cx} ${y0Top}, ${cx} ${y1Top}, ${centerX0} ${y1Top} L ${centerX0} ${y1Bot} C ${cx} ${y1Bot}, ${cx} ${y0Bot}, ${leftX1} ${y0Bot} Z`;
      return {
        id: `flow-${n.id}`,
        nodeId: n.id,
        from: n.label,
        to: "Kas APBD Daerah",
        value: n.value,
        pct: n.pct,
        color: n.color,
        d,
      };
    });

    let rightCenterCursor = center.y;
    const rightFlows = right.map((n) => {
      const srcH = (n.value / totalRight) * center.h;
      const y0Top = rightCenterCursor;
      const y0Bot = rightCenterCursor + srcH;
      rightCenterCursor += srcH;
      const y1Top = n.y;
      const y1Bot = n.y + n.h;
      const cx = (centerX1 + rightX0) / 2;
      const d = `M ${centerX1} ${y0Top} C ${cx} ${y0Top}, ${cx} ${y1Top}, ${rightX0} ${y1Top} L ${rightX0} ${y1Bot} C ${cx} ${y1Bot}, ${cx} ${y0Bot}, ${centerX1} ${y0Bot} Z`;
      return {
        id: `flow-${n.id}`,
        nodeId: n.id,
        from: "Kas APBD Daerah",
        to: n.label,
        value: n.value,
        pct: n.pct,
        color: n.color,
        d,
      };
    });

    return {
      leftNodes: left,
      centerNode: center,
      rightNodes: right,
      flows: [...leftFlows, ...rightFlows],
    };
  }, [revenue, expenditure, region.name]);

  const activeFlow = flows.find((f) => f.nodeId === hoveredId);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-col gap-2 border-b border-border pb-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <GitBranch
              className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400"
              aria-hidden="true"
            />
            <span>Arus Kas APBD TA {region.fiscal_year} • Akun Ekonomi DJPK</span>
          </div>
          <CardTitle className="mt-1 text-base">
            Pendapatan → Kas APBD → Pos Belanja ({region.name})
          </CardTitle>
          <CardDescription className="text-xs">
            Seluruh aliran diambil persis dari akun klasifikasi ekonomi resmi
            DJPK Kemenkeu RI.
          </CardDescription>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowTable((v) => !v)}
          className="shrink-0 font-mono text-xs"
        >
          {showTable ? (
            <>
              <BarChart2 className="h-3.5 w-3.5" aria-hidden="true" />
              Diagram Sankey
            </>
          ) : (
            <>
              <TableIcon className="h-3.5 w-3.5" aria-hidden="true" />
              Tabel Angka
            </>
          )}
        </Button>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col justify-between space-y-3 pt-4">
        {/* Live Inspection Strip */}
        <div
          aria-live="polite"
          className="flex min-h-[38px] items-center justify-between gap-2 rounded-md border border-border bg-secondary/40 px-3 py-1.5 text-xs"
        >
          {activeFlow ? (
            <>
              <span className="font-medium text-foreground">
                {activeFlow.from} → <strong>{activeFlow.to}</strong>
              </span>
              <span className="font-mono font-bold text-foreground tabular-nums">
                {formatMiliarToTriliun(activeFlow.value)} ({activeFlow.pct}%)
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">
              Total Belanja{" "}
              <strong className="font-mono text-foreground tabular-nums">
                {formatMiliarToTriliun(expenditure.total_belanja_miliar)}
              </strong>{" "}
              • Realisasi{" "}
              <strong className="font-mono text-emerald-700 dark:text-emerald-400 tabular-nums">
                {formatMiliarToTriliun(expenditure.realisasi_belanja_miliar)} (
                {expenditure.serapan_belanja_pct}%)
              </strong>
            </span>
          )}
        </div>

        {showTable ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Alur Dana</TableHead>
                <TableHead>Akun DJPK</TableHead>
                <TableHead className="text-right">Anggaran (Rp)</TableHead>
                <TableHead className="text-right">Porsi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flows.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {f.from}
                  </TableCell>
                  <TableCell className="text-xs font-medium">{f.to}</TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">
                    {formatMiliarToTriliun(f.value)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">
                    {f.pct}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="w-full overflow-x-auto">
            <svg
              viewBox="0 0 740 365"
              className="h-auto w-full min-w-[560px] select-none"
              role="img"
              aria-label={`Diagram Sankey arus uang APBD ${region.name} berdasarkan akun resmi DJPK Kemenkeu`}
            >
              <text
                x="10"
                y="15"
                className="fill-muted-foreground font-mono text-[10px] font-semibold uppercase"
              >
                Sumber Pendapatan
              </text>
              <text
                x="360"
                y="15"
                textAnchor="middle"
                className="fill-muted-foreground font-mono text-[10px] font-semibold uppercase"
              >
                Pool APBD
              </text>
              <text
                x="730"
                y="15"
                textAnchor="end"
                className="fill-muted-foreground font-mono text-[10px] font-semibold uppercase"
              >
                Alokasi Belanja (DJPK)
              </text>

              {flows.map((f) => {
                const isDimmed = hoveredId !== null && hoveredId !== f.nodeId;
                const isActive = hoveredId === f.nodeId;
                return (
                  <path
                    key={f.id}
                    d={f.d}
                    fill={f.color}
                    fillOpacity={isActive ? 0.62 : isDimmed ? 0.1 : 0.34}
                    className="cursor-pointer transition-opacity duration-200"
                    onMouseEnter={() => setHoveredId(f.nodeId)}
                    onMouseLeave={() => setHoveredId(null)}
                    tabIndex={0}
                    onFocus={() => setHoveredId(f.nodeId)}
                    onBlur={() => setHoveredId(null)}
                  >
                    <title>
                      {`${f.from} → ${f.to}: ${formatMiliarToTriliun(f.value)} (${f.pct}%)`}
                    </title>
                  </path>
                );
              })}

              {leftNodes.map((n) => (
                <g
                  key={n.id}
                  onMouseEnter={() => setHoveredId(n.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className="cursor-pointer"
                >
                  <rect
                    x="182"
                    y={n.y}
                    width="14"
                    height={n.h}
                    rx="2"
                    fill={n.color}
                  />
                  <text
                    x="174"
                    y={n.y + n.h / 2 - 4}
                    textAnchor="end"
                    className="fill-foreground text-[11px] font-semibold"
                  >
                    {n.label}
                  </text>
                  <text
                    x="174"
                    y={n.y + n.h / 2 + 10}
                    textAnchor="end"
                    className="fill-muted-foreground font-mono text-[10px]"
                  >
                    {formatMiliarToTriliun(n.value)} ({n.pct}%)
                  </text>
                </g>
              ))}

              <g>
                <rect
                  x="335"
                  y={centerNode.y}
                  width="50"
                  height={centerNode.h}
                  rx="4"
                  className="fill-foreground"
                />
                <text
                  x="360"
                  y={centerNode.y + centerNode.h / 2 - 6}
                  textAnchor="middle"
                  className="fill-background font-mono text-[10px] font-bold"
                >
                  APBD
                </text>
                <text
                  x="360"
                  y={centerNode.y + centerNode.h / 2 + 10}
                  textAnchor="middle"
                  className="fill-background/80 font-mono text-[9px]"
                >
                  {formatMiliarToTriliun(centerNode.value).replace("Rp ", "")}
                </text>
              </g>

              {rightNodes.map((n) => (
                <g
                  key={n.id}
                  onMouseEnter={() => setHoveredId(n.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className="cursor-pointer"
                >
                  <rect
                    x="524"
                    y={n.y}
                    width="14"
                    height={n.h}
                    rx="2"
                    fill={n.color}
                  />
                  <text
                    x="546"
                    y={n.y + n.h / 2 - 3}
                    textAnchor="start"
                    className="fill-foreground text-[11px] font-semibold"
                  >
                    {n.label}
                  </text>
                  <text
                    x="546"
                    y={n.y + n.h / 2 + 10}
                    textAnchor="start"
                    className="fill-muted-foreground font-mono text-[10px]"
                  >
                    {formatMiliarToTriliun(n.value)} ({n.pct}%)
                  </text>
                </g>
              ))}
            </svg>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
