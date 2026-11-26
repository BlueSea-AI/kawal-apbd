import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { HkpdGrade } from "@/types/apbd";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRupiah(amountIdr: number, compact = false): string {
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

export function formatMiliarToTriliun(miliar: number): string {
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

export function formatNumberId(value: number, decimals = 1): string {
  return value.toLocaleString("id-ID", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatPopulation(pop: number): string {
  if (pop >= 1_000_000) {
    return `${(pop / 1_000_000).toLocaleString("id-ID", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} Juta`;
  }
  return `${Math.round(pop / 1000).toLocaleString("id-ID")} Ribu`;
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
