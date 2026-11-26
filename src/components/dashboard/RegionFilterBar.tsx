"use client";

import * as React from "react";
import { Search, Filter, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RegionCombobox } from "@/components/ui/region-combobox";
import type { HkpdGrade, IslandCluster, RegionLevel, RegionRecord } from "@/types/apbd";

const ISLANDS: Array<"Semua" | IslandCluster> = [
  "Semua",
  "Sumatera",
  "Jawa",
  "Bali & Nusa Tenggara",
  "Kalimantan",
  "Sulawesi",
  "Maluku & Papua",
];

interface RegionFilterBarProps {
  regions: RegionRecord[];
  selectedRegionId: string;
  onSelectRegion: (id: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  levelFilter: "semua" | RegionLevel;
  onLevelChange: (lvl: "semua" | RegionLevel) => void;
  islandFilter: "Semua" | IslandCluster;
  onIslandChange: (isl: "Semua" | IslandCluster) => void;
  gradeFilter: "semua" | HkpdGrade;
  onGradeChange: (g: "semua" | HkpdGrade) => void;
  filteredCount: number;
}

export function RegionFilterBar({
  regions,
  selectedRegionId,
  onSelectRegion,
  searchQuery,
  onSearchChange,
  levelFilter,
  onLevelChange,
  islandFilter,
  onIslandChange,
  gradeFilter,
  onGradeChange,
  filteredCount,
}: RegionFilterBarProps) {
  const hasFilters =
    searchQuery.trim() !== "" ||
    levelFilter !== "semua" ||
    islandFilter !== "Semua" ||
    gradeFilter !== "semua";

  const resetFilters = () => {
    onSearchChange("");
    onLevelChange("semua");
    onIslandChange("Semua");
    onGradeChange("semua");
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        {/* Searchable Region Combobox (handles 546+ Pemda at 60fps) */}
        <div className="lg:col-span-4">
          <label
            htmlFor="active-region-select"
            className="mb-1.5 block font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Daerah Sedang Diaudit
          </label>
          <RegionCombobox
            id="active-region-select"
            regions={regions}
            value={selectedRegionId}
            onChange={onSelectRegion}
            placeholder="Cari kabupaten, kota, atau provinsi..."
            ariaLabel="Pilih daerah yang sedang diaudit"
          />
        </div>

        {/* Global Search (matches name, parent province, island, BPS code) */}
        <div className="lg:col-span-3">
          <label
            htmlFor="region-search-input"
            className="mb-1.5 block font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Saring Daftar &amp; Grafik
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="region-search-input"
              type="search"
              placeholder="Nama kota/kab atau provinsi..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-11 pl-9"
            />
          </div>
        </div>

        {/* Island Cluster */}
        <div className="sm:col-span-1 lg:col-span-2">
          <label
            htmlFor="island-filter-select"
            className="mb-1.5 block font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Wilayah Kepulauan
          </label>
            <select
              id="island-filter-select"
              value={islandFilter}
              onChange={(e) =>
                onIslandChange(e.target.value as "Semua" | IslandCluster)
              }
              className="h-11 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {ISLANDS.map((isl) => (
                <option key={isl} value={isl}>
                  {isl}
                </option>
              ))}
            </select>
          </div>

          {/* Level + Grade Filters */}
          <div className="grid grid-cols-2 gap-2 lg:col-span-3">
            <div>
              <label
                htmlFor="level-filter-select"
                className="mb-1.5 block font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Tingkat
              </label>
              <select
                id="level-filter-select"
                value={levelFilter}
                onChange={(e) =>
                  onLevelChange(e.target.value as "semua" | RegionLevel)
                }
                className="h-11 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="semua">Semua</option>
                <option value="provinsi">Provinsi</option>
                <option value="kota">Kota</option>
                <option value="kabupaten">Kabupaten</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="grade-filter-select"
                className="mb-1.5 block font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Rapor HKPD
              </label>
              <select
                id="grade-filter-select"
                value={gradeFilter}
                onChange={(e) =>
                  onGradeChange(e.target.value as "semua" | HkpdGrade)
                }
                className="h-11 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
              <option value="semua">Semua</option>
              <option value="hijau">Rapor Hijau</option>
              <option value="kuning">Rapor Kuning</option>
              <option value="merah">Rapor Merah</option>
            </select>
          </div>
        </div>
      </div>

      {/* Filter status strip */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          <span>
            Menampilkan{" "}
            <strong className="font-mono text-foreground">{filteredCount}</strong>{" "}
            dari {regions.length} entitas pemerintah daerah
          </span>
        </div>
        {hasFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="h-7 px-2 text-xs"
          >
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
            Reset Filter
          </Button>
        )}
      </div>
    </div>
  );
}
