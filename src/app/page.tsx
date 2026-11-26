import * as React from "react";
import type { Metadata } from "next";
import { loadApbdDataset } from "@/lib/data-loader";
import { KawalApbdApp } from "@/components/dashboard/KawalApbdApp";

export async function generateMetadata(): Promise<Metadata> {
  const { summary } = await loadApbdDataset();
  const kabKotaTotal = summary.total_kab_kota ?? summary.total_kab_kota_samples;
  return {
    title: `Kawal APBD TA ${summary.fiscal_year} — Platform Audit Fiskal & Data Terbuka Daerah Indonesia`,
    description: `Audit terbuka APBD TA ${summary.fiscal_year} seluruh ${summary.total_provinces} provinsi dan ${kabKotaTotal} kabupaten/kota otonom Indonesia berbasis data resmi DJPK Kemenkeu RI dan BPS RI (${summary.bps_year}).`,
  };
}

export default async function HomePage() {
  const { regions, summary } = await loadApbdDataset();
  return <KawalApbdApp regions={regions} summary={summary} />;
}
