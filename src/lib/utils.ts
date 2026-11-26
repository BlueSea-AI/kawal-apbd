import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { FiscalCluster, HkpdGrade, RegionLevel } from "@/types/apbd";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRupiah(
  amountIdr: number | null | undefined,
  compact = false
): string {
  if (amountIdr === null || amountIdr === undefined || !Number.isFinite(amountIdr)) {
    return "—";
  }
  if (compact) {
    const abs = Math.abs(amountIdr);
    if (abs >= 1_000_000_000_000) {
      return `Rp ${(amountIdr / 1_000_000_000_000).toLocaleString("id-ID", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 2,
      })} T`;
    }
    if (abs >= 1_000_000_000) {
      return `Rp ${(amountIdr / 1_000_000_000).toLocaleString("id-ID", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })} M`;
    }
    if (abs >= 1_000_000) {
      return `Rp ${(amountIdr / 1_000_000).toLocaleString("id-ID", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 2,
      })} Jt`;
    }
  }
  return `Rp ${Math.round(amountIdr).toLocaleString("id-ID")}`;
}

export function formatMiliarToTriliun(
  miliar: number | null | undefined
): string {
  if (miliar === null || miliar === undefined || !Number.isFinite(miliar)) {
    return "—";
  }
  if (miliar >= 1000) {
    return `Rp ${(miliar / 1000).toLocaleString("id-ID", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} T`;
  }
  return `Rp ${miliar.toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })} M`;
}

export function formatNumberId(
  value: number | null | undefined,
  decimals = 1
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return value.toLocaleString("id-ID", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatPopulation(pop: number | null | undefined): string {
  if (pop === null || pop === undefined || !Number.isFinite(pop)) {
    return "—";
  }
  if (pop >= 1_000_000) {
    return `${(pop / 1_000_000).toLocaleString("id-ID", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} Juta`;
  }
  return `${Math.round(pop / 1000).toLocaleString("id-ID")} Ribu`;
}

export function getEntityPeerGroupLabel(level: RegionLevel): string {
  return level === "provinsi" ? "Provinsi" : "Kab/Kota";
}

export function getFiscalClusterStyles(cluster: FiscalCluster) {
  switch (cluster) {
    case "Tinggi":
      return {
        label: "Klaster Fiskal Tinggi",
        shortLabel: "Tinggi",
        badgeClass:
          "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-400/35",
        dotClass: "bg-blue-600 dark:bg-blue-400",
      };
    case "Sedang":
      return {
        label: "Klaster Fiskal Sedang",
        shortLabel: "Sedang",
        badgeClass:
          "bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-400/35",
        dotClass: "bg-teal-600 dark:bg-teal-400",
      };
    case "Rendah":
      return {
        label: "Klaster Fiskal Rendah",
        shortLabel: "Rendah",
        badgeClass:
          "bg-stone-100 text-stone-700 border-stone-300 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-400/35",
        dotClass: "bg-stone-500 dark:bg-slate-400",
      };
  }
}

export function getGradeStyles(grade: HkpdGrade) {
  switch (grade) {
    case "hijau":
      return {
        label: "Rapor Hijau",
        shortLabel: "HIJAU",
        hex: "#059669",
        badgeClass:
          "bg-[var(--rapor-hijau-bg)] text-[var(--rapor-hijau)] border-[var(--rapor-hijau-border)]",
        textClass: "text-[var(--rapor-hijau)]",
        barClass: "bg-emerald-500",
      };
    case "kuning":
      return {
        label: "Rapor Kuning",
        shortLabel: "KUNING",
        hex: "#D97706",
        badgeClass:
          "bg-[var(--rapor-kuning-bg)] text-[var(--rapor-kuning)] border-[var(--rapor-kuning-border)]",
        textClass: "text-[var(--rapor-kuning)]",
        barClass: "bg-amber-500",
      };
    case "merah":
      return {
        label: "Rapor Merah",
        shortLabel: "MERAH",
        hex: "#DC2626",
        badgeClass:
          "bg-[var(--rapor-merah-bg)] text-[var(--rapor-merah)] border-[var(--rapor-merah-border)]",
        textClass: "text-[var(--rapor-merah)]",
        barClass: "bg-red-500",
      };
  }
}
