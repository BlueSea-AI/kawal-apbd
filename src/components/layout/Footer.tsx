import * as React from "react";
import {
  Landmark,
  Database,
  Scale,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import type { NationalSummary } from "@/types/apbd";

const OFFICIAL_PORTALS = [
  {
    label: "Portal Data APBD — DJPK Kemenkeu RI",
    href: "https://djpk.kemenkeu.go.id/portal/data/apbd",
  },
  {
    label: "Statistik Sosial & IPM — BPS RI",
    href: "https://www.bps.go.id/",
  },
  {
    label: "UU No. 1 Tahun 2022 (UU HKPD)",
    href: "https://peraturan.bpk.go.id/Details/195696/uu-no-1-tahun-2022",
  },
];

const QUICK_SECTIONS = [
  { label: "Audit Bento", href: "#dashboard" },
  { label: "Peta 3D Nusantara", href: "#peta-3d" },
  { label: "Struk Pajak", href: "#struk-pajak" },
  { label: "Adu Efisiensi 1v1", href: "#adu-daerah" },
  { label: "Direktori Nasional", href: "#direktori-daerah" },
];

export function Footer({ summary }: { summary: NationalSummary }) {
  const verifiedDate = summary.generated_at.slice(0, 10);
  const kabKotaTotal = summary.total_kab_kota ?? summary.total_kab_kota_samples;

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
              membedah postur APBD, serapan realisasi, klaster kapasitas fiskal,
              dan korelasi dampak sosial di seluruh {summary.total_provinces}{" "}
              provinsi serta {kabKotaTotal} kabupaten/kota otonom Indonesia.
            </p>
            <nav
              aria-label="Tautan cepat bagian halaman"
              className="flex flex-wrap gap-x-3 gap-y-1.5 pt-1 font-mono text-[11px]"
            >
              {QUICK_SECTIONS.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>

          <div className="space-y-2.5">
            <h4 className="flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-wider text-foreground">
              <Database
                className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400"
                aria-hidden="true"
              />
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
            <div className="flex flex-wrap gap-x-3 gap-y-1.5 pt-1 font-mono text-[11px]">
              {OFFICIAL_PORTALS.map((portal) => (
                <a
                  key={portal.href}
                  href={portal.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-4 hover:underline"
                >
                  <span>{portal.label}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>

          <div className="space-y-2.5">
            <h4 className="flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-wider text-foreground">
              <Scale
                className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400"
                aria-hidden="true"
              />
              Transparansi Metodologi
            </h4>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Audit dihitung sepenuhnya dari akun klasifikasi ekonomi DJPK
              Kemenkeu (Plafon Belanja Pegawai ≤ 30% UU HKPD Pasal 146, Belanja
              Modal, dan Serapan Realisasi) serta stratifikasi Klaster Kapasitas
              Fiskal terpisah antara Provinsi dan Kab/Kota. Sub-akun klasifikasi
              fungsi yang belum dipublikasikan terbuka ditandai eksplisit
              sebagai <em>Belum Dipublikasikan</em>.
            </p>
            <div className="flex items-center gap-1.5 pt-1 font-mono text-[11px] text-muted-foreground">
              <ShieldCheck
                className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
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
            Kawal APBD — Platform Transparansi Anggaran Daerah Indonesia (TA{" "}
            {summary.fiscal_year}).
          </p>
          <p className="font-mono text-[11px]">
            Data Publik DJPK Kemenkeu RI &amp; BPS RI • Lisensi Data Terbuka
          </p>
        </div>
      </div>
    </footer>
  );
}
