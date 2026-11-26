"use client";

import * as React from "react";
import { toPng } from "html-to-image";
import { Receipt, Download, Copy, Check, Landmark } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RegionCombobox } from "@/components/ui/region-combobox";
import type { RegionRecord } from "@/types/apbd";
import { calculateTaxReceipt } from "@/lib/audit-engine";
import { cn, formatRupiah } from "@/lib/utils";

const TAX_PRESETS = [
  { label: "Rp 500 rb", value: 500_000 },
  { label: "Rp 1 Juta", value: 1_000_000 },
  { label: "Rp 5 Juta", value: 5_000_000 },
  { label: "Rp 10 Juta", value: 10_000_000 },
];

interface StrukBelanjaPajakProps {
  regions: RegionRecord[];
  defaultRegionId: string;
}

export function StrukBelanjaPajak({
  regions,
  defaultRegionId,
}: StrukBelanjaPajakProps) {
  const [regionId, setRegionId] = React.useState(defaultRegionId);
  const [taxAmount, setTaxAmount] = React.useState<number>(1_000_000);
  const [taxInputStr, setTaxInputStr] = React.useState<string>("1000000");
  const [taxpayerName, setTaxpayerName] = React.useState<string>(
    "WARGA PEMBAYAR PAJAK"
  );
  const [exporting, setExporting] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [exportMsg, setExportMsg] = React.useState<string | null>(null);

  const receiptRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    setRegionId(defaultRegionId);
  }, [defaultRegionId]);

  const activeRegion = regions.find((r) => r.id === regionId) ?? regions[0];

  const breakdown = React.useMemo(
    () => calculateTaxReceipt(activeRegion, taxAmount),
    [activeRegion, taxAmount]
  );

  const handleTaxInput = (raw: string) => {
    const cleaned = raw.replace(/[^0-9]/g, "");
    setTaxInputStr(cleaned);
    const num = cleaned ? Math.min(10_000_000_000, Number(cleaned)) : 0;
    setTaxAmount(num);
  };

  const applyPreset = (val: number) => {
    setTaxAmount(val);
    setTaxInputStr(String(val));
  };

  const handleDownloadPng = async () => {
    if (!receiptRef.current) return;
    setExporting(true);
    setExportMsg(null);
    try {
      const dataUrl = await toPng(receiptRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#0f172a",
      });
      const link = document.createElement("a");
      const slug = activeRegion.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-");
      link.download = `struk-apbd-${slug}-${taxAmount}.png`;
      link.href = dataUrl;
      link.click();
      setExportMsg("Struk PNG resolusi tinggi berhasil diunduh.");
    } catch {
      setExportMsg("Gagal merender PNG. Coba ulangi atau gunakan Salin Teks.");
    } finally {
      setExporting(false);
    }
  };

  const handleCopySummary = async () => {
    const lines = [
      `STRUK BELANJA PAJAK — ${activeRegion.name.toUpperCase()} (TA ${activeRegion.fiscal_year})`,
      `Kontribusi Pajak/Retribusi: ${formatRupiah(breakdown.taxAmountIdr)}`,
      `--------------------------------`,
      ...breakdown.items.map(
        (i) => `- ${i.label}: ${formatRupiah(i.amountIdr)} (${i.percentage}%)`
      ),
      `--------------------------------`,
      `Belanja Pegawai/Aparatur: ${formatRupiah(breakdown.aparaturTotalIdr)} (${breakdown.aparaturPct}%)`,
      `Belanja Non-Pegawai (Operasi, Modal, Bansos, Transfer): ${formatRupiah(breakdown.publicTotalIdr)} (${breakdown.publicPct}%)`,
      `Rapor Audit Fiskal: ${activeRegion.hkpd.grade_label.toUpperCase()} (${activeRegion.hkpd.score}/100)`,
      `Sumber Resmi: DJPK Kemenkeu RI TA ${activeRegion.fiscal_year}`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setExportMsg("Clipboard tidak tersedia di browser ini.");
    }
  };

  const stampBorder =
    activeRegion.hkpd.grade === "hijau"
      ? "border-emerald-700 text-emerald-800 bg-emerald-50"
      : activeRegion.hkpd.grade === "kuning"
      ? "border-amber-700 text-amber-800 bg-amber-50"
      : "border-red-700 text-red-800 bg-red-50";

  return (
    <section id="struk-pajak" className="scroll-mt-20">
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border bg-secondary/40">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Receipt
                  className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400"
                  aria-hidden="true"
                />
                <span>Simulator Transparansi • Akun Ekonomi DJPK TA {activeRegion.fiscal_year}</span>
              </div>
              <CardTitle className="mt-1 text-xl">
                Struk Belanja Pajak Daerahmu
              </CardTitle>
              <CardDescription className="mt-1 max-w-2xl text-sm">
                Masukkan estimasi pajak atau retribusi tahunanmu (PBB, PKB, PB1
                restoran, atau pajak daerah lainnya) untuk melihat pembagian
                proporsional persis sesuai akun belanja resmi DJPK Kemenkeu RI.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5 sm:p-6">
          <div className="grid items-start gap-8 lg:grid-cols-12">
            {/* Left Controls */}
            <div className="space-y-5 lg:col-span-5">
              <div>
                <label
                  htmlFor="receipt-region-select"
                  className="mb-1.5 block font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  1. Pilih Provinsi / Kabupaten / Kota ({regions.length} Pemda)
                </label>
                <RegionCombobox
                  id="receipt-region-select"
                  regions={regions}
                  value={activeRegion.id}
                  onChange={setRegionId}
                  placeholder="Cari nama kota, kabupaten, atau provinsi..."
                  ariaLabel="Pilih daerah untuk simulasi struk belanja pajak"
                />
              </div>

              <div>
                <label
                  htmlFor="receipt-tax-input"
                  className="mb-1.5 block font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  2. Nominal Pajak / Retribusi Tahunan (Rupiah)
                </label>
                <Input
                  id="receipt-tax-input"
                  type="text"
                  inputMode="numeric"
                  value={taxInputStr}
                  onChange={(e) => handleTaxInput(e.target.value)}
                  placeholder="1000000"
                  className="h-11 font-mono text-base font-semibold tabular-nums"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {TAX_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => applyPreset(preset.value)}
                      className={cn(
                        "rounded-md border px-2.5 py-1 font-mono text-xs transition-colors",
                        taxAmount === preset.value
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-background text-foreground hover:border-foreground/50"
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="receipt-name-input"
                  className="mb-1.5 block font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  3. Nama / Alias di Struk (Opsional)
                </label>
                <Input
                  id="receipt-name-input"
                  type="text"
                  maxLength={28}
                  value={taxpayerName}
                  onChange={(e) => setTaxpayerName(e.target.value)}
                  placeholder="WARGA PEMBAYAR PAJAK"
                  className="h-10 font-mono text-xs uppercase"
                />
              </div>

              {/* Instant Summary Callout */}
              <div className="space-y-2 rounded-md border border-border bg-secondary/40 p-4">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-foreground">
                  Ringkasan Proporsi Resmi ({activeRegion.name})
                </p>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="rounded-md border border-red-600/25 bg-red-500/5 p-3">
                    <span className="block text-[11px] text-muted-foreground">
                      Belanja Pegawai ASN
                    </span>
                    <strong className="font-mono text-sm font-bold text-red-700 dark:text-red-400 tabular-nums">
                      {formatRupiah(breakdown.aparaturTotalIdr)}
                    </strong>
                    <span className="block font-mono text-[11px] text-muted-foreground tabular-nums">
                      ({breakdown.aparaturPct}%)
                    </span>
                  </div>
                  <div className="rounded-md border border-emerald-600/25 bg-emerald-500/5 p-3">
                    <span className="block text-[11px] text-muted-foreground">
                      Non-Pegawai &amp; Modal
                    </span>
                    <strong className="font-mono text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                      {formatRupiah(breakdown.publicTotalIdr)}
                    </strong>
                    <span className="block font-mono text-[11px] text-muted-foreground tabular-nums">
                      ({breakdown.publicPct}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* Export Actions */}
              <div className="flex flex-wrap gap-3 pt-1">
                <Button
                  type="button"
                  variant="default"
                  size="lg"
                  onClick={handleDownloadPng}
                  disabled={exporting || taxAmount <= 0}
                  className="flex-1 font-sans text-sm font-semibold"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  {exporting ? "Merender PNG..." : "Unduh Struk (PNG)"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={handleCopySummary}
                  className="font-sans text-sm font-semibold"
                >
                  {copied ? (
                    <>
                      <Check
                        className="h-4 w-4 text-emerald-600 dark:text-emerald-400"
                        aria-hidden="true"
                      />
                      Tersalin
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" aria-hidden="true" />
                      Salin Teks
                    </>
                  )}
                </Button>
              </div>
              {exportMsg && (
                <p role="status" className="font-mono text-xs text-foreground">
                  {exportMsg}
                </p>
              )}
            </div>

            {/* Right Thermal POS Receipt Stage (Export Target) */}
            <div className="flex justify-center lg:col-span-7">
              <div
                ref={receiptRef}
                className="w-full max-w-[430px] rounded-xl bg-slate-900 p-5 shadow-xl sm:p-6"
              >
                <div
                  className="receipt-zig-top h-3.5 w-full"
                  aria-hidden="true"
                />

                <div className="bg-[#FFFDF8] px-5 py-5 font-mono text-slate-900">
                  <div className="border-b border-dashed border-slate-400 pb-3.5 text-center">
                    <div className="mx-auto mb-1.5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-slate-900">
                      <Landmark
                        className="h-4 w-4 text-slate-900"
                        aria-hidden="true"
                      />
                    </div>
                    <p className="text-base font-bold tracking-widest">
                      KAWAL APBD
                    </p>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                      PEMDA {activeRegion.name}
                    </p>
                    {activeRegion.level !== "provinsi" && (
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                        PROVINSI {activeRegion.province_name}
                      </p>
                    )}
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      STRUK ALOKASI APBD RESMI DJPK • TA{" "}
                      {activeRegion.fiscal_year}
                    </p>
                  </div>

                  <div className="space-y-1 border-b border-dashed border-slate-400 py-2.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">PEMBAYAR:</span>
                      <span className="max-w-[200px] truncate font-bold uppercase">
                        {taxpayerName.trim() || "WARGA RI"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">KODE BPS / DJPK:</span>
                      <span>
                        {activeRegion.bps_code} / {activeRegion.djpk_code}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">TOTAL SETORAN:</span>
                      <span className="font-bold tabular-nums">
                        {formatRupiah(breakdown.taxAmountIdr)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2.5 border-b border-dashed border-slate-400 py-3">
                    <div className="flex justify-between text-[10px] font-bold uppercase text-slate-500">
                      <span>AKUN EKONOMI DJPK</span>
                      <span>JUMLAH (RP)</span>
                    </div>

                    {breakdown.items.map((item) => (
                      <div key={item.key} className="space-y-0.5">
                        <div className="flex items-start justify-between gap-2 text-[11px]">
                          <span className="font-bold leading-tight text-slate-900">
                            {item.label}
                          </span>
                          <span className="shrink-0 font-bold tabular-nums text-slate-900">
                            {formatRupiah(item.amountIdr)}
                          </span>
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-500">
                          <span>{item.sublabel}</span>
                          <span className="tabular-nums">{item.percentage}%</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1.5 border-b border-dashed border-slate-400 py-3 text-xs">
                    <div className="flex justify-between text-red-800">
                      <span>BELANJA PEGAWAI ({breakdown.aparaturPct}%)</span>
                      <span className="font-bold tabular-nums">
                        {formatRupiah(breakdown.aparaturTotalIdr)}
                      </span>
                    </div>
                    <div className="flex justify-between text-emerald-800">
                      <span>NON-PEGAWAI ({breakdown.publicPct}%)</span>
                      <span className="font-bold tabular-nums">
                        {formatRupiah(breakdown.publicTotalIdr)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-slate-300 pt-1.5 text-sm font-extrabold">
                      <span>TOTAL PAJAKMU</span>
                      <span className="tabular-nums">
                        {formatRupiah(breakdown.taxAmountIdr)}
                      </span>
                    </div>
                  </div>

                  <div className="py-3.5 text-center">
                    <div
                      className={cn(
                        "inline-block -rotate-1 rounded border-2 px-3 py-1 text-xs font-extrabold uppercase tracking-wider",
                        stampBorder
                      )}
                    >
                      {activeRegion.hkpd.grade_label} • SKOR{" "}
                      {activeRegion.hkpd.score}/100
                    </div>
                    <p className="mt-2 text-[10px] text-slate-600">
                      SERAPAN REALISASI:{" "}
                      {activeRegion.expenditure.serapan_belanja_pct}% • PAD:{" "}
                      {activeRegion.revenue.pad_ratio_pct}%
                    </p>
                  </div>

                  <div className="border-t border-dashed border-slate-400 pt-3 text-center">
                    <div
                      aria-hidden="true"
                      className="mx-auto flex h-7 w-56 items-stretch justify-center gap-[2px] opacity-85"
                    >
                      {[
                        3, 1, 2, 1, 4, 1, 2, 3, 1, 2, 1, 3, 2, 1, 4, 1, 2, 1, 3,
                        1, 2, 3, 1, 2, 1, 3, 2, 1,
                      ].map((w, i) => (
                        <span
                          key={i}
                          className="bg-slate-900"
                          style={{ width: `${w * 2}px` }}
                        />
                      ))}
                    </div>
                    <p className="mt-1.5 text-[10px] tracking-[0.2em] text-slate-600">
                      *DJPK-{activeRegion.djpk_code}-TA{activeRegion.fiscal_year}*
                    </p>
                    <p className="mt-1 text-[9px] text-slate-500">
                      Data Resmi: DJPK Kemenkeu RI &amp; BPS RI
                    </p>
                  </div>
                </div>

                <div
                  className="receipt-zig-bottom h-3.5 w-full"
                  aria-hidden="true"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
