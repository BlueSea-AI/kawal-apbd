"use client";

import * as React from "react";
import {
  ArrowUpDown,
  Award,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Layers,
  MapPin,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { FiscalCluster, RegionRecord } from "@/types/apbd";
import {
  cn,
  formatMiliarToTriliun,
  getFiscalClusterStyles,
  getGradeStyles,
} from "@/lib/utils";

const PAGE_SIZE = 25;

const CLUSTER_ORDER: Record<FiscalCluster, number> = {
  Tinggi: 3,
  Sedang: 2,
  Rendah: 1,
};

type SortField =
  | "rank"
  | "name"
  | "cluster"
  | "apbd"
  | "serapan"
  | "hkpd"
  | "pegawai"
  | "modal"
  | "ipm"
  | "poverty";

interface RegionLeaderboardTableProps {
  regions: RegionRecord[];
  allRegions?: RegionRecord[];
  fiscalYear?: number;
  selectedRegionId: string;
  onSelectRegion: (id: string) => void;
}

export function RegionLeaderboardTable({
  regions,
  allRegions,
  fiscalYear,
  selectedRegionId,
  onSelectRegion,
}: RegionLeaderboardTableProps) {
  const [sortField, setSortField] = React.useState<SortField>("rank");
  const [sortAsc, setSortAsc] = React.useState(true);
  const [provinceFilter, setProvinceFilter] = React.useState<string>("semua");
  const [clusterFilter, setClusterFilter] = React.useState<
    "semua" | FiscalCluster
  >("semua");
  const [tableQuery, setTableQuery] = React.useState<string>("");
  const [page, setPage] = React.useState<number>(1);

  const sourceForProvinces = allRegions ?? regions;
  const activeFiscalYear =
    fiscalYear ??
    allRegions?.[0]?.fiscal_year ??
    regions[0]?.fiscal_year ??
    2026;

  // Build sorted list of all 38 provinces with entity counts for "Filter per Provinsi"
  const provinceOptions = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of regions) {
      if (clusterFilter !== "semua" && r.fiscal_cluster !== clusterFilter) {
        continue;
      }
      counts.set(r.province_id, (counts.get(r.province_id) ?? 0) + 1);
    }
    return sourceForProvinces
      .filter((r) => r.level === "provinsi")
      .map((p) => ({
        id: p.id,
        name: p.name,
        count: counts.get(p.id) ?? 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "id"));
  }, [sourceForProvinces, regions, clusterFilter]);

  const clusterCounts = React.useMemo(() => {
    const counts: Record<FiscalCluster, number> = {
      Tinggi: 0,
      Sedang: 0,
      Rendah: 0,
    };
    for (const r of regions) {
      if (provinceFilter !== "semua" && r.province_id !== provinceFilter) {
        continue;
      }
      if (r.fiscal_cluster in counts) {
        counts[r.fiscal_cluster] += 1;
      }
    }
    return counts;
  }, [regions, provinceFilter]);

  const totalProvCount = React.useMemo(
    () => sourceForProvinces.filter((r) => r.level === "provinsi").length,
    [sourceForProvinces]
  );
  const totalKabKotaCount = React.useMemo(
    () => sourceForProvinces.filter((r) => r.level !== "provinsi").length,
    [sourceForProvinces]
  );

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc((v) => !v);
    } else {
      setSortField(field);
      setSortAsc(
        field === "rank" ||
          field === "name" ||
          field === "pegawai" ||
          field === "poverty"
      );
    }
    setPage(1);
  };

  // Instant filtering by Province dropdown + Fiscal Cluster dropdown + local search
  const filteredAndSorted = React.useMemo(() => {
    const q = tableQuery.trim().toLowerCase();
    const tokens = q ? q.split(/\s+/).filter(Boolean) : [];

    const filtered = regions.filter((r) => {
      if (provinceFilter !== "semua" && r.province_id !== provinceFilter) {
        return false;
      }
      if (clusterFilter !== "semua" && r.fiscal_cluster !== clusterFilter) {
        return false;
      }
      if (tokens.length > 0) {
        const hay =
          `${r.name} ${r.province_name ?? ""} ${r.island} ${r.bps_code} ${r.djpk_code} ${r.level} ${r.fiscal_cluster}`.toLowerCase();
        if (!tokens.every((t) => hay.includes(t))) {
          return false;
        }
      }
      return true;
    });

    filtered.sort((a, b) => {
      // Sort null BPS indicators strictly to the end regardless of sort direction
      if (sortField === "ipm") {
        const va = a.bps.ipm;
        const vb = b.bps.ipm;
        if (va === null && vb === null) return 0;
        if (va === null) return 1;
        if (vb === null) return -1;
        return sortAsc ? va - vb : vb - va;
      }
      if (sortField === "poverty") {
        const va = a.bps.poverty_rate_pct;
        const vb = b.bps.poverty_rate_pct;
        if (va === null && vb === null) return 0;
        if (va === null) return 1;
        if (vb === null) return -1;
        return sortAsc ? va - vb : vb - va;
      }

      let diff = 0;
      switch (sortField) {
        case "rank":
          diff = a.effectiveness.rank_national - b.effectiveness.rank_national;
          break;
        case "name":
          diff = a.name.localeCompare(b.name, "id");
          break;
        case "cluster":
          diff =
            (CLUSTER_ORDER[a.fiscal_cluster] ?? 0) -
              (CLUSTER_ORDER[b.fiscal_cluster] ?? 0) ||
            b.fiscal_cluster_rank - a.fiscal_cluster_rank;
          break;
        case "apbd":
          diff =
            a.expenditure.total_belanja_miliar -
            b.expenditure.total_belanja_miliar;
          break;
        case "serapan":
          diff =
            a.expenditure.serapan_belanja_pct -
            b.expenditure.serapan_belanja_pct;
          break;
        case "hkpd":
          diff = a.hkpd.score - b.hkpd.score;
          break;
        case "pegawai":
          diff = a.expenditure.pegawai_pct - b.expenditure.pegawai_pct;
          break;
        case "modal":
          diff = a.expenditure.modal_pct - b.expenditure.modal_pct;
          break;
      }
      return sortAsc ? diff : -diff;
    });

    return filtered;
  }, [regions, provinceFilter, clusterFilter, tableQuery, sortField, sortAsc]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredAndSorted.length / PAGE_SIZE)
  );
  const safePage = Math.min(page, totalPages);

  React.useEffect(() => {
    setPage(1);
  }, [regions, provinceFilter, clusterFilter, tableQuery]);

  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageEnd = Math.min(filteredAndSorted.length, pageStart + PAGE_SIZE);
  const pageRows = React.useMemo(
    () => filteredAndSorted.slice(pageStart, pageEnd),
    [filteredAndSorted, pageStart, pageEnd]
  );

  // Build compact numbered page window (e.g., [1, '...', 4, 5, 6, '...', 22])
  const pageNumbers = React.useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const items: Array<number | "ellipsis"> = [1];
    const start = Math.max(2, safePage - 1);
    const end = Math.min(totalPages - 1, safePage + 1);
    if (start > 2) items.push("ellipsis");
    for (let p = start; p <= end; p++) items.push(p);
    if (end < totalPages - 1) items.push("ellipsis");
    items.push(totalPages);
    return items;
  }, [safePage, totalPages]);

  const hasLocalFilter =
    provinceFilter !== "semua" ||
    clusterFilter !== "semua" ||
    tableQuery.trim() !== "";

  const resetLocalFilters = () => {
    setProvinceFilter("semua");
    setClusterFilter("semua");
    setTableQuery("");
  };

  const SortButton = ({
    field,
    label,
  }: {
    field: SortField;
    label: string;
  }) => (
    <button
      type="button"
      onClick={() => toggleSort(field)}
      className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
    >
      <span>{label}</span>
      <ArrowUpDown
        className={cn(
          "h-3 w-3",
          sortField === field ? "text-foreground" : "opacity-45"
        )}
        aria-hidden="true"
      />
    </button>
  );

  return (
    <Card>
      <CardHeader className="space-y-4 border-b border-border pb-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Award
                className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400"
                aria-hidden="true"
              />
              <span>
                Direktori &amp; Peringkat Audit Nasional • TA {activeFiscalYear}
              </span>
            </div>
            <CardTitle className="mt-1 text-base">
              Rapor Seluruh {totalProvCount} Provinsi &amp; {totalKabKotaCount}{" "}
              Kabupaten/Kota Otonom
            </CardTitle>
            <CardDescription className="text-xs">
              Klik baris daerah untuk memuat audit rinci, arus kas DJPK, dan
              fokus Peta 3D Nusantara. Gunakan Filter Klaster Fiskal untuk
              perbandingan setara.
            </CardDescription>
          </div>
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {filteredAndSorted.length} entitas terverifikasi
          </span>
        </div>

        {/* Fast Leaderboard Search + Filter per Provinsi + Filter Klaster Fiskal */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
          <div className="sm:col-span-2 lg:col-span-4">
            <label
              htmlFor="leaderboard-search-input"
              className="mb-1 block font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Cari Daerah / Nama Provinsi Induk
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="leaderboard-search-input"
                type="text"
                autoComplete="off"
                placeholder="Contoh: Banyuwangi, Jawa Tengah, 3578..."
                value={tableQuery}
                onChange={(e) => setTableQuery(e.target.value)}
                className="h-10 pl-9 pr-8 text-xs"
              />
              {tableQuery && (
                <button
                  type="button"
                  onClick={() => setTableQuery("")}
                  aria-label="Hapus pencarian tabel"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          <div className="lg:col-span-3">
            <label
              htmlFor="leaderboard-province-filter"
              className="mb-1 flex items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              <MapPin className="h-3 w-3" aria-hidden="true" />
              <span>Filter per Provinsi</span>
            </label>
            <select
              id="leaderboard-province-filter"
              value={provinceFilter}
              onChange={(e) => setProvinceFilter(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="semua">
                Semua Provinsi ({totalProvCount} Prov • {regions.length} Pemda)
              </option>
              {provinceOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.count} Pemda)
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-3">
            <label
              htmlFor="leaderboard-cluster-filter"
              className="mb-1 flex items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              <Layers className="h-3 w-3" aria-hidden="true" />
              <span>Filter Klaster Fiskal</span>
            </label>
            <select
              id="leaderboard-cluster-filter"
              value={clusterFilter}
              onChange={(e) =>
                setClusterFilter(e.target.value as "semua" | FiscalCluster)
              }
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="semua">
                Semua Klaster (
                {clusterCounts.Tinggi +
                  clusterCounts.Sedang +
                  clusterCounts.Rendah}
                )
              </option>
              <option value="Tinggi">
                Fiskal Tinggi ({clusterCounts.Tinggi})
              </option>
              <option value="Sedang">
                Fiskal Sedang ({clusterCounts.Sedang})
              </option>
              <option value="Rendah">
                Fiskal Rendah ({clusterCounts.Rendah})
              </option>
            </select>
          </div>

          <div className="flex items-end justify-between gap-2 sm:col-span-2 lg:col-span-2 lg:justify-end">
            {hasLocalFilter ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={resetLocalFilters}
                className="h-10 w-full font-mono text-xs lg:w-auto"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Reset Tabel
              </Button>
            ) : (
              <span className="font-mono text-[11px] text-muted-foreground tabular-nums lg:pb-2.5">
                {PAGE_SIZE} baris / hal
              </span>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-0 sm:p-5 sm:pt-4">
        <div className="overflow-x-auto rounded-md border border-border">
          <Table>
            <TableHeader className="bg-secondary/80">
              <TableRow>
                <TableHead>
                  <SortButton field="rank" label="#" />
                </TableHead>
                <TableHead>
                  <SortButton field="name" label="Daerah" />
                </TableHead>
                <TableHead>
                  <SortButton field="cluster" label="Klaster" />
                </TableHead>
                <TableHead className="text-right">
                  <SortButton field="apbd" label="APBD" />
                </TableHead>
                <TableHead className="text-right">
                  <SortButton field="serapan" label="Serapan" />
                </TableHead>
                <TableHead className="text-right">
                  <SortButton field="hkpd" label="Skor Fiskal" />
                </TableHead>
                <TableHead className="text-right">
                  <SortButton field="pegawai" label="Pegawai" />
                </TableHead>
                <TableHead className="text-right">
                  <SortButton field="modal" label="Modal" />
                </TableHead>
                <TableHead className="text-right">
                  <SortButton field="ipm" label="IPM" />
                </TableHead>
                <TableHead className="text-right">
                  <SortButton field="poverty" label="Miskin" />
                </TableHead>
                <TableHead>Profil Fiskal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="py-10 text-center">
                    <p className="text-sm font-medium text-foreground">
                      Tidak ada daerah yang cocok dengan filter saat ini.
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Coba ubah filter provinsi, klaster fiskal, atau hapus kata
                      kunci pencarian.
                    </p>
                    {hasLocalFilter && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={resetLocalFilters}
                        className="mt-3 font-mono text-xs"
                      >
                        Tampilkan Semua Daerah
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((r) => {
                  const isSelected = r.id === selectedRegionId;
                  const gradeStyle = getGradeStyles(r.hkpd.grade);
                  const clusterStyle = getFiscalClusterStyles(r.fiscal_cluster);
                  return (
                    <TableRow
                      key={r.id}
                      data-state={isSelected ? "selected" : undefined}
                      onClick={() => onSelectRegion(r.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelectRegion(r.id);
                        }
                      }}
                      tabIndex={0}
                      className="cursor-pointer"
                    >
                      <TableCell className="font-mono text-xs font-semibold text-muted-foreground tabular-nums">
                        #{r.effectiveness.rank_national}
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-foreground">
                          {r.name}
                        </div>
                        <div className="font-mono text-[10px] text-muted-foreground">
                          {r.level === "provinsi"
                            ? `Provinsi • ${r.island} • ${r.bps_code}`
                            : `${r.province_name} • ${r.level} • ${r.bps_code}`}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold",
                            clusterStyle.badgeClass
                          )}
                        >
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              clusterStyle.dotClass
                            )}
                            aria-hidden="true"
                          />
                          {clusterStyle.shortLabel}
                        </span>
                        <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground tabular-nums">
                          #{r.fiscal_cluster_rank}/{r.fiscal_cluster_total}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right font-mono text-xs tabular-nums">
                        {formatMiliarToTriliun(
                          r.expenditure.total_belanja_miliar
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground tabular-nums">
                        {r.expenditure.serapan_belanja_pct}%
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        <Badge
                          variant={r.hkpd.grade}
                          className="font-mono text-[11px] tabular-nums"
                        >
                          {r.hkpd.score} ({gradeStyle.shortLabel})
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-mono text-xs tabular-nums",
                          r.hkpd.pegawai_compliant
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "font-semibold text-red-600 dark:text-red-400"
                        )}
                      >
                        {r.expenditure.pegawai_pct}%
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-mono text-xs tabular-nums",
                          r.hkpd.infrastruktur_compliant
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-amber-700 dark:text-amber-400"
                        )}
                      >
                        {r.expenditure.modal_pct}%
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">
                        {r.bps.ipm !== null ? r.bps.ipm : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">
                        {r.bps.poverty_rate_pct !== null
                          ? `${r.bps.poverty_rate_pct}%`
                          : "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {r.effectiveness.archetype}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Accessible 25-Row Pagination Controls */}
        <nav
          aria-label="Navigasi halaman tabel rapor daerah"
          className="flex flex-col items-center justify-between gap-3 px-4 pb-4 sm:flex-row sm:px-0 sm:pb-0"
        >
          <p className="font-mono text-xs text-muted-foreground tabular-nums">
            {filteredAndSorted.length > 0 ? (
              <>
                Menampilkan{" "}
                <strong className="text-foreground">
                  {pageStart + 1}–{pageEnd}
                </strong>{" "}
                dari{" "}
                <strong className="text-foreground">
                  {filteredAndSorted.length}
                </strong>{" "}
                daerah (Hal. {safePage} / {totalPages})
              </>
            ) : (
              "0 daerah ditemukan"
            )}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={safePage <= 1}
              onClick={() => setPage(1)}
              aria-label="Halaman pertama"
              className="h-9 w-9"
            >
              <ChevronsLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Halaman sebelumnya"
              className="h-9 w-9"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </Button>

            {pageNumbers.map((item, idx) =>
              item === "ellipsis" ? (
                <span
                  key={`e-${idx}`}
                  className="px-1.5 font-mono text-xs text-muted-foreground"
                  aria-hidden="true"
                >
                  …
                </span>
              ) : (
                <Button
                  key={item}
                  type="button"
                  variant={item === safePage ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPage(item)}
                  aria-label={`Halaman ${item}`}
                  aria-current={item === safePage ? "page" : undefined}
                  className="h-9 min-w-9 px-2.5 font-mono text-xs tabular-nums"
                >
                  {item}
                </Button>
              )
            )}

            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label="Halaman berikutnya"
              className="h-9 w-9"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={safePage >= totalPages}
              onClick={() => setPage(totalPages)}
              aria-label="Halaman terakhir"
              className="h-9 w-9"
            >
              <ChevronsRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </nav>
      </CardContent>
    </Card>
  );
}
