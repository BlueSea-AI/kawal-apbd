"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search, X, Building2 } from "lucide-react";
import type { RegionRecord } from "@/types/apbd";
import { cn, formatMiliarToTriliun, getGradeStyles } from "@/lib/utils";

const MAX_RENDERED_OPTIONS = 45;

const SUGGESTION_TERMS = ["DKI Jakarta", "Jawa Timur", "Surabaya", "Bandung", "Papua"];

type QuickScope = "semua" | "provinsi" | "kabkota";

interface RegionComboboxProps {
  id: string;
  regions: RegionRecord[];
  value: string;
  onChange: (regionId: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  accentTone?: "default" | "emerald" | "amber";
  className?: string;
}

/**
 * High-performance searchable combobox for 546+ Indonesian regions (38 provinces + 508 kab/kota).
 * - Matches by region name, parent province name, island, BPS code, or DJPK code.
 * - Caps visible DOM rows to 45 for guaranteed 60fps interaction.
 * - Full keyboard navigation (ArrowUp/ArrowDown/Enter/Escape) & ARIA listbox semantics.
 */
export function RegionCombobox({
  id,
  regions,
  value,
  onChange,
  placeholder = "Cari kabupaten, kota, atau provinsi...",
  ariaLabel = "Pilih daerah",
  accentTone = "default",
  className,
}: RegionComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [scope, setScope] = React.useState<QuickScope>("semua");
  const [activeIndex, setActiveIndex] = React.useState(0);

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const listRef = React.useRef<HTMLUListElement | null>(null);

  const selectedRegion = React.useMemo(
    () => regions.find((r) => r.id === value) ?? regions[0],
    [regions, value]
  );

  // Pre-build lightweight lowercase search haystack once when regions array changes
  const indexedRegions = React.useMemo(
    () =>
      regions.map((r) => ({
        region: r,
        nameLower: r.name.toLowerCase(),
        provLower: (r.province_name ?? "").toLowerCase(),
        haystack: `${r.name} ${r.province_name ?? ""} ${r.island} ${r.bps_code} ${r.djpk_code} ${r.level}`.toLowerCase(),
      })),
    [regions]
  );

  const { visibleOptions, totalMatches } = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const tokens = q ? q.split(/\s+/).filter(Boolean) : [];

    const matched: Array<{ region: RegionRecord; rank: number }> = [];

    for (const item of indexedRegions) {
      const r = item.region;
      if (scope === "provinsi" && r.level !== "provinsi") continue;
      if (scope === "kabkota" && r.level === "provinsi") continue;

      if (tokens.length === 0) {
        matched.push({ region: r, rank: r.level === "provinsi" ? 0 : 1 });
        continue;
      }

      let allMatch = true;
      for (const tok of tokens) {
        if (!item.haystack.includes(tok)) {
          allMatch = false;
          break;
        }
      }
      if (!allMatch) continue;

      // Prioritize exact/prefix name matches, then province name matches, then general matches
      let rank = 3;
      if (item.nameLower.startsWith(q)) {
        rank = 0;
      } else if (item.nameLower.includes(q)) {
        rank = 1;
      } else if (item.provLower.startsWith(q)) {
        rank = r.level === "provinsi" ? 0 : 2;
      }
      matched.push({ region: r, rank });
    }

    if (tokens.length > 0) {
      matched.sort((a, b) => {
        if (a.rank !== b.rank) return a.rank - b.rank;
        if (a.region.level === "provinsi" && b.region.level !== "provinsi") return -1;
        if (a.region.level !== "provinsi" && b.region.level === "provinsi") return 1;
        return a.region.name.localeCompare(b.region.name, "id");
      });
    }

    return {
      totalMatches: matched.length,
      visibleOptions: matched.slice(0, MAX_RENDERED_OPTIONS).map((m) => m.region),
    };
  }, [indexedRegions, query, scope]);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query, scope, open]);

  React.useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  React.useEffect(() => {
    if (open) {
      // Focus search input cleanly on next frame
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  React.useEffect(() => {
    if (!open || !listRef.current) return;
    const activeEl = listRef.current.querySelector<HTMLElement>(
      `[data-option-idx="${activeIndex}"]`
    );
    activeEl?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const handleSelect = (regionId: string) => {
    onChange(regionId);
    setOpen(false);
    setQuery("");
    triggerRef.current?.focus();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) =>
        visibleOptions.length > 0 ? Math.min(visibleOptions.length - 1, prev + 1) : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(0, prev - 1));
    } else if (e.key === "Enter" && visibleOptions[activeIndex]) {
      e.preventDefault();
      handleSelect(visibleOptions[activeIndex].id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }
  };

  const selectedGrade = selectedRegion ? getGradeStyles(selectedRegion.hkpd.grade) : null;

  const accentBorder =
    accentTone === "emerald"
      ? "border-emerald-600/45 focus-visible:ring-emerald-600"
      : accentTone === "amber"
      ? "border-amber-600/45 focus-visible:ring-amber-600"
      : "border-input focus-visible:ring-ring";

  const listboxId = `${id}-listbox`;

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 rounded-md border bg-background px-3 text-left transition-colors hover:border-foreground/50 focus-visible:outline-none focus-visible:ring-2",
          accentBorder
        )}
      >
        <div className="min-w-0 flex-1">
          {selectedRegion ? (
            <>
              <div className="truncate text-sm font-semibold leading-tight text-foreground">
                {selectedRegion.name}
              </div>
              <div className="truncate font-mono text-[10px] leading-tight text-muted-foreground">
                {selectedRegion.level === "provinsi"
                  ? `Provinsi • ${selectedRegion.island}`
                  : `${selectedRegion.province_name} • Kode ${selectedRegion.bps_code}`}
              </div>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">{placeholder}</span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {selectedRegion && selectedGrade && (
            <span
              className={cn(
                "hidden rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums sm:inline-block",
                selectedGrade.badgeClass
              )}
            >
              {selectedRegion.hkpd.score}
            </span>
          )}
          <ChevronsUpDown
            className="h-4 w-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        </div>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 overflow-hidden rounded-md border border-border bg-popover shadow-xl">
          {/* Search Input Bar */}
          <div className="border-b border-border bg-card p-2">
            <div className="relative flex items-center">
              <Search
                className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                ref={inputRef}
                type="text"
                autoComplete="off"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder={placeholder}
                aria-label="Ketik nama kabupaten, kota, atau provinsi"
                className="h-9 w-full rounded border border-input bg-background pl-8 pr-8 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                  aria-label="Hapus kata kunci"
                  className="absolute right-2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Scope Filter Pills + Match Count */}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5">
              <div className="flex items-center gap-1">
                {(
                  [
                    { key: "semua", label: "Semua" },
                    { key: "provinsi", label: "Provinsi" },
                    { key: "kabkota", label: "Kab/Kota" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setScope(tab.key);
                      inputRef.current?.focus();
                    }}
                    className={cn(
                      "rounded px-2 py-0.5 font-mono text-[10px] font-semibold transition-colors",
                      scope === tab.key
                        ? "bg-foreground text-background"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                {totalMatches > MAX_RENDERED_OPTIONS
                  ? `${MAX_RENDERED_OPTIONS} / ${totalMatches} hasil`
                  : `${totalMatches} daerah`}
              </span>
            </div>
          </div>

          {/* Options List */}
          {visibleOptions.length === 0 ? (
            <div className="space-y-2 p-3 text-xs text-muted-foreground">
              <p>
                Tidak ditemukan daerah untuk{" "}
                <strong className="text-foreground">&ldquo;{query}&rdquo;</strong>.
                Coba nama provinsi atau kota:
              </p>
              <div className="flex flex-wrap gap-1">
                {SUGGESTION_TERMS.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => {
                      setQuery(term);
                      setScope("semua");
                      inputRef.current?.focus();
                    }}
                    className="rounded border border-border bg-secondary/60 px-2 py-0.5 font-mono text-[10px] text-foreground hover:border-foreground"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ul
              ref={listRef}
              id={listboxId}
              role="listbox"
              aria-label={ariaLabel}
              className="max-h-64 divide-y divide-border/60 overflow-y-auto py-0.5"
            >
              {visibleOptions.map((r, idx) => {
                const isSelected = r.id === value;
                const isActive = idx === activeIndex;
                const gs = getGradeStyles(r.hkpd.grade);
                return (
                  <li key={r.id} data-option-idx={idx}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => handleSelect(r.id)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors",
                        isActive ? "bg-muted" : "hover:bg-muted/60",
                        isSelected && "bg-secondary/70"
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                          {isSelected ? (
                            <Check
                              className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"
                              aria-hidden="true"
                            />
                          ) : r.level === "provinsi" ? (
                            <Building2
                              className="h-3 w-3 text-muted-foreground"
                              aria-hidden="true"
                            />
                          ) : (
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: gs.hex }}
                            />
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-foreground">
                            {r.name}
                          </p>
                          <p className="truncate font-mono text-[10px] text-muted-foreground">
                            {r.level === "provinsi"
                              ? `Provinsi • ${r.island}`
                              : `${r.province_name} • ${r.bps_code}`}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 text-right font-mono tabular-nums">
                        <span className="block text-[11px] font-semibold text-foreground">
                          {formatMiliarToTriliun(r.expenditure.total_belanja_miliar)}
                        </span>
                        <span className={cn("text-[10px] font-semibold", gs.textClass)}>
                          {r.hkpd.score} ({gs.shortLabel})
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {totalMatches > MAX_RENDERED_OPTIONS && (
            <div className="border-t border-border bg-secondary/40 px-3 py-1.5 font-mono text-[10px] text-muted-foreground">
              Ketik nama kota, kabupaten, atau provinsi untuk menyaring {totalMatches} daerah.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
