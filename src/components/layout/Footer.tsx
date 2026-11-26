import * as React from "react";
import { Landmark, Database, Scale, ShieldCheck } from "lucide-react";
import type { NationalSummary } from "@/types/apbd";

export function Footer({ summary }: { summary: NationalSummary }) {
  const verifiedDate = summary.generated_at.slice(0, 10);

  return (
    <footer className="mt-16 border-t border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-3">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-foreground text-background">
                <Landmark className="h-4 w-4" aria-hidden="true" />
              </div>
              <span className="font-sans text-sm font-extrabold tracking-tight text-foreground">
                KAWAL APBD
              </span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Platform jurnalisme data dan pemantauan fiskal terbuka untuk
              membedah postur APBD, serapan realisasi, dan korelasi dampak
              sosial di seluruh {summary.total_provinces} provinsi serta{" "}
              {summary.total_kab_kota ?? summary.total_kab_kota_samples}{" "}
              kabupaten/kota otonom Indonesia.
            </p>
          </div>

          <div className="space-y-2.5">
            <h4 className="flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-wider text-foreground">
              <Database className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
              Sumber Data Resmi
            </h4>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              {summary.data_sources.map((src) => (
                <li key={src} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/50" />
                  <span>{src}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2.5">
            <h4 className="flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-wider text-foreground">
              <Scale className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400" aria-hidden="true" />
              Transparansi Metodologi
            </h4>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Audit dihitung sepenuhnya dari akun klasifikasi ekonomi DJPK
              Kemenkeu (Plafon Belanja Pegawai ≤ 30% UU HKPD Pasal 146, Belanja
              Modal, dan Serapan Realisasi). Sub-akun klasifikasi fungsi yang
              belum dipublikasikan terbuka ditandai eksplisit sebagai{" "}
              <em>Data Belum Dipublikasikan Resmi</em>.
            </p>
            <div className="flex items-center gap-1.5 pt-1 font-mono text-[11px] text-muted-foreground">
              <ShieldCheck
                className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"
                aria-hidden="true"
              />
              <span>
                Verifikasi Terakhir: {verifiedDate} • TA {summary.fiscal_year} /
                BPS {summary.bps_year}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row">
          <p>
            Kawal APBD — Platform Transparansi Anggaran Daerah Indonesia.
          </p>
          <p className="font-mono text-[11px]">
            Data Publik DJPK Kemenkeu RI &amp; BPS RI • Lisensi Data Terbuka
          </p>
        </div>
      </div>
    </footer>
  );
}
