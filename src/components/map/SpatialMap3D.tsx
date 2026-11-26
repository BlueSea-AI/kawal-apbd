"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import {
  Box,
  Building2,
  ChevronDown,
  ChevronUp,
  Compass,
  Layers,
  Map as MapIcon,
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { RegionRecord } from "@/types/apbd";
import {
  cn,
  formatMiliarToTriliun,
  formatNumberId,
  getGradeStyles,
} from "@/lib/utils";

const CARTO_POSITRON_STYLE =
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const CARTO_DARK_MATTER_STYLE =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const INDONESIA_CENTER: [number, number] = [118.0, -2.5];
const INDONESIA_ZOOM = 4.1;
const INDONESIA_PITCH = 42;
const INDONESIA_BEARING = -4;

interface SpatialMap3DProps {
  regions: RegionRecord[];
  selectedRegion: RegionRecord;
  onSelectRegion: (id: string) => void;
}

interface HoverFeatureInfo {
  id: string;
  province_code: string;
  name: string;
  island: string;
  kab_kota_count: number;
  total_apbd_triliun: number;
  serapan_belanja_pct: number;
  hkpd_score: number;
  grade: "hijau" | "kuning" | "merah";
  grade_label: string;
  pegawai_pct: number;
  modal_pct: number;
  ipm: number | null;
}

export function SpatialMap3D({
  regions,
  selectedRegion,
  onSelectRegion,
}: SpatialMap3DProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<import("maplibre-gl").Map | null>(null);
  const styleReadyRef = React.useRef(false);
  const hoveredFeatureIdRef = React.useRef<number | string | null>(null);
  const is3DRef = React.useRef(true);
  const selectedProvIdRef = React.useRef(selectedRegion.province_id);
  const onSelectRef = React.useRef(onSelectRegion);
  const lastThemeRef = React.useRef<"light" | "dark" | null>(null);

  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [is3D, setIs3D] = React.useState(true);
  const [mapLoaded, setMapLoaded] = React.useState(false);
  const [webglFailed, setWebglFailed] = React.useState(false);
  const [hovered, setHovered] = React.useState<HoverFeatureInfo | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(true);
  const [drillFilter, setDrillFilter] = React.useState("");
  const [drillSort, setDrillSort] = React.useState<"name" | "score" | "apbd">("name");

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    selectedProvIdRef.current = selectedRegion.province_id;
    setDrillFilter("");
  }, [selectedRegion.province_id]);

  React.useEffect(() => {
    onSelectRef.current = onSelectRegion;
  }, [onSelectRegion]);

  React.useEffect(() => {
    is3DRef.current = is3D;
  }, [is3D]);

  const provinces = React.useMemo(
    () => regions.filter((r) => r.level === "provinsi"),
    [regions]
  );

  const activeProvince = React.useMemo(
    () =>
      provinces.find((p) => p.id === selectedRegion.province_id) ??
      provinces[0],
    [provinces, selectedRegion.province_id]
  );

  const provinceKabKota = React.useMemo(() => {
    const q = drillFilter.trim().toLowerCase();
    const list = regions.filter(
      (r) =>
        r.province_id === selectedRegion.province_id &&
        r.level !== "provinsi" &&
        (!q || r.name.toLowerCase().includes(q) || r.bps_code.includes(q))
    );
    list.sort((a, b) => {
      if (drillSort === "score") return b.hkpd.score - a.hkpd.score;
      if (drillSort === "apbd") {
        return b.expenditure.total_belanja_miliar - a.expenditure.total_belanja_miliar;
      }
      return a.name.localeCompare(b.name, "id");
    });
    return list;
  }, [regions, selectedRegion.province_id, drillFilter, drillSort]);

  const totalKabKotaInProvince = React.useMemo(
    () =>
      regions.filter(
        (r) => r.province_id === selectedRegion.province_id && r.level !== "provinsi"
      ).length,
    [regions, selectedRegion.province_id]
  );

  const attachProvinceOverlay = React.useCallback(
    (map: import("maplibre-gl").Map, isDark: boolean) => {
      if (!map.getSource("provinces")) {
        map.addSource("provinces", {
          type: "geojson",
          data: "/data/indonesia_provinces.geojson",
        });
      }

      // Directional lighting for crisp 3D extrusion shading
      try {
        map.setLight({
          anchor: "viewport",
          color: isDark ? "#dbeafe" : "#fffbf0",
          intensity: isDark ? 0.42 : 0.38,
          position: [1.3, 210, 35],
        });
      } catch {
        // Older GPU contexts ignore light adjustments safely
      }

      const extrusionHeightExpr: import("maplibre-gl").ExpressionSpecification =
        [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          ["*", ["get", "extrusion_height"], 1.32],
          ["get", "extrusion_height"],
        ];

      const gradeColorExpr: import("maplibre-gl").ExpressionSpecification = [
        "case",
        ["boolean", ["feature-state", "hover"], false],
        [
          "match",
          ["get", "grade"],
          "hijau",
          "#34D399",
          "kuning",
          "#FBBF24",
          "merah",
          "#F87171",
          "#64748B",
        ],
        [
          "match",
          ["get", "grade"],
          "hijau",
          isDark ? "#10B981" : "#059669",
          "kuning",
          isDark ? "#F59E0B" : "#D97706",
          "merah",
          isDark ? "#EF4444" : "#DC2626",
          "#475569",
        ],
      ];

      // Flat choropleth fill layer (visible in 2D mode and also grounds coastlines)
      if (!map.getLayer("provinces-fill")) {
        map.addLayer({
          id: "provinces-fill",
          type: "fill",
          source: "provinces",
          layout: {
            visibility: is3DRef.current ? "none" : "visible",
          },
          paint: {
            "fill-color": gradeColorExpr,
            "fill-opacity": 0.82,
          },
        });
      }

      // 3D extruded province volumes (fill-extrusion-opacity MUST be a constant number per MapLibre spec)
      if (!map.getLayer("provinces-3d")) {
        map.addLayer({
          id: "provinces-3d",
          type: "fill-extrusion",
          source: "provinces",
          layout: {
            visibility: is3DRef.current ? "visible" : "none",
          },
          paint: {
            "fill-extrusion-color": gradeColorExpr,
            "fill-extrusion-height": extrusionHeightExpr,
            "fill-extrusion-base": 0,
            "fill-extrusion-opacity": 0.88,
            "fill-extrusion-vertical-gradient": true,
          },
        });
      }

      if (!map.getLayer("provinces-outline")) {
        map.addLayer({
          id: "provinces-outline",
          type: "line",
          source: "provinces",
          paint: {
            "line-color": isDark ? "#0B0F17" : "#F8F7F4",
            "line-width": 1.0,
            "line-opacity": 0.85,
          },
        });
      }

      if (!map.getLayer("provinces-selected")) {
        map.addLayer({
          id: "provinces-selected",
          type: "line",
          source: "provinces",
          filter: ["==", ["get", "id"], selectedProvIdRef.current],
          paint: {
            "line-color": isDark ? "#F8FAFC" : "#0F172A",
            "line-width": 2.8,
          },
        });
      }

      styleReadyRef.current = true;
    },
    []
  );

  // Initialize MapLibre GL JS once client theme is resolved (prevents SSR/theme flash & StrictMode races)
  React.useEffect(() => {
    if (!mounted || !containerRef.current) return;
    let cancelled = false;
    const initialTheme: "light" | "dark" =
      resolvedTheme === "dark" ? "dark" : "light";
    lastThemeRef.current = initialTheme;

    const init = async () => {
      try {
        const maplibregl = (await import("maplibre-gl")).default;
        if (cancelled || !containerRef.current) return;

        const map = new maplibregl.Map({
          container: containerRef.current,
          style:
            initialTheme === "dark"
              ? CARTO_DARK_MATTER_STYLE
              : CARTO_POSITRON_STYLE,
          center: INDONESIA_CENTER,
          zoom: INDONESIA_ZOOM,
          pitch: INDONESIA_PITCH,
          bearing: INDONESIA_BEARING,
          minZoom: 3.0,
          maxZoom: 9.0,
          attributionControl: { compact: true },
        });

        map.addControl(
          new maplibregl.NavigationControl({ visualizePitch: true }),
          "top-right"
        );

        map.on("style.load", () => {
          if (cancelled) return;
          attachProvinceOverlay(map, lastThemeRef.current === "dark");
          setMapLoaded(true);
        });

        const handlePointerMove = (e: import("maplibre-gl").MapLayerMouseEvent) => {
          if (!styleReadyRef.current) return;
          map.getCanvas().style.cursor = "pointer";
          const feature = e.features?.[0];
          if (!feature) return;

          if (
            hoveredFeatureIdRef.current !== null &&
            hoveredFeatureIdRef.current !== feature.id
          ) {
            map.setFeatureState(
              { source: "provinces", id: hoveredFeatureIdRef.current },
              { hover: false }
            );
          }

          if (feature.id !== undefined) {
            hoveredFeatureIdRef.current = feature.id;
            map.setFeatureState(
              { source: "provinces", id: feature.id },
              { hover: true }
            );
          }

          if (feature.properties) {
            const p = feature.properties;
            setHovered({
              id: String(p.id),
              province_code: String(p.province_code ?? p.bps_code ?? ""),
              name: String(p.name),
              island: String(p.island),
              kab_kota_count: Number(p.kab_kota_count ?? 0),
              total_apbd_triliun: Number(p.total_apbd_triliun),
              serapan_belanja_pct: Number(p.serapan_belanja_pct ?? 0),
              hkpd_score: Number(p.hkpd_score),
              grade: (p.grade as "hijau" | "kuning" | "merah") ?? "kuning",
              grade_label: String(p.grade_label),
              pegawai_pct: Number(p.pegawai_pct),
              modal_pct: Number(p.modal_pct ?? p.infrastruktur_pct),
              ipm: p.ipm !== null && p.ipm !== undefined ? Number(p.ipm) : null,
            });
          }
        };

        const handlePointerLeave = () => {
          map.getCanvas().style.cursor = "";
          if (styleReadyRef.current && hoveredFeatureIdRef.current !== null) {
            map.setFeatureState(
              { source: "provinces", id: hoveredFeatureIdRef.current },
              { hover: false }
            );
            hoveredFeatureIdRef.current = null;
          }
          setHovered(null);
        };

        const handleLayerClick = (e: import("maplibre-gl").MapLayerMouseEvent) => {
          const feature = e.features?.[0];
          const regionId = feature?.properties?.id;
          if (regionId) {
            onSelectRef.current(String(regionId));
            setDrawerOpen(true);
          }
        };

        for (const layerId of ["provinces-3d", "provinces-fill"]) {
          map.on("mousemove", layerId, handlePointerMove);
          map.on("mouseleave", layerId, handlePointerLeave);
          map.on("click", layerId, handleLayerClick);
        }

        map.on("error", () => {
          // Non-fatal tile fetch hiccups keep interactive GeoJSON working cleanly
        });

        mapRef.current = map;
      } catch {
        if (!cancelled) {
          setWebglFailed(true);
        }
      }
    };

    init();

    return () => {
      cancelled = true;
      styleReadyRef.current = false;
      hoveredFeatureIdRef.current = null;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // Seamlessly switch CARTO Positron <-> CARTO Dark Matter when theme toggles
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !mounted || !resolvedTheme) return;
    const nextTheme: "light" | "dark" =
      resolvedTheme === "dark" ? "dark" : "light";
    if (lastThemeRef.current === nextTheme) return;

    lastThemeRef.current = nextTheme;
    styleReadyRef.current = false;
    hoveredFeatureIdRef.current = null;
    map.setStyle(
      nextTheme === "dark" ? CARTO_DARK_MATTER_STYLE : CARTO_POSITRON_STYLE
    );
  }, [resolvedTheme, mounted]);

  // Sync selected province highlight filter safely
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !styleReadyRef.current) return;
    if (map.getLayer("provinces-selected")) {
      map.setFilter("provinces-selected", [
        "==",
        ["get", "id"],
        selectedRegion.province_id,
      ]);
    }
  }, [selectedRegion.province_id, mapLoaded]);

  const toggle3D = (enable3D: boolean) => {
    setIs3D(enable3D);
    is3DRef.current = enable3D;
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;
    if (map.getLayer("provinces-3d")) {
      map.setLayoutProperty(
        "provinces-3d",
        "visibility",
        enable3D ? "visible" : "none"
      );
    }
    if (map.getLayer("provinces-fill")) {
      map.setLayoutProperty(
        "provinces-fill",
        "visibility",
        enable3D ? "none" : "visible"
      );
    }
    map.easeTo({
      pitch: enable3D ? INDONESIA_PITCH : 0,
      bearing: enable3D ? INDONESIA_BEARING : 0,
      duration: 600,
    });
  };

  const resetCamera = () => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({
      center: INDONESIA_CENTER,
      zoom: INDONESIA_ZOOM,
      pitch: is3D ? INDONESIA_PITCH : 0,
      bearing: is3D ? INDONESIA_BEARING : 0,
      duration: 750,
    });
  };

  const focusSelected = () => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({
      center: selectedRegion.centroid,
      zoom: 5.8,
      pitch: is3D ? 48 : 0,
      duration: 850,
    });
  };

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader className="flex flex-col gap-3 border-b border-border pb-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <MapIcon className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
            <span>Peta Spasial 3D Nusantara • CARTO × Batas BIG/BPS</span>
          </div>
          <CardTitle className="mt-1 text-base">
            Tinggi Ekstrusi = Skala APBD TA 2025 • Warna = Rapor Fiskal
          </CardTitle>
          <CardDescription className="text-xs">
            38 Provinsi Indonesia (termasuk 4 DOB Papua). Arahkan kursor untuk
            inspeksi atau klik provinsi untuk mengaudit.
          </CardDescription>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            variant={is3D ? "default" : "outline"}
            size="sm"
            onClick={() => toggle3D(true)}
            className="font-mono text-xs"
          >
            <Box className="h-3.5 w-3.5" aria-hidden="true" />
            3D
          </Button>
          <Button
            type="button"
            variant={!is3D ? "default" : "outline"}
            size="sm"
            onClick={() => toggle3D(false)}
            className="font-mono text-xs"
          >
            <Layers className="h-3.5 w-3.5" aria-hidden="true" />
            2D
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={focusSelected}
            className="font-mono text-xs"
            title="Fokus kamera ke daerah aktif"
          >
            <Compass className="h-3.5 w-3.5" aria-hidden="true" />
            Fokus
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={resetCamera}
            aria-label="Reset sudut kamera peta Nusantara"
            className="h-8 w-8"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col space-y-3 pt-4">
        {/* Map Canvas Container */}
        <div className="relative h-[400px] w-full overflow-hidden rounded-md border border-border bg-secondary/40 sm:h-[440px]">
          {webglFailed ? (
            <div className="flex h-full flex-col justify-between overflow-y-auto p-4 text-xs">
              <p className="font-mono text-muted-foreground">
                Mode Indeks Provinsi (Fallback Non-WebGL): Pilih provinsi di
                bawah ini.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {provinces.map((p) => {
                  const st = getGradeStyles(p.hkpd.grade);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onSelectRegion(p.id)}
                      className="rounded-md border border-border bg-card p-2 text-left hover:border-foreground"
                    >
                      <div className="truncate font-semibold text-foreground">
                        {p.name}
                      </div>
                      <div className="mt-1 flex items-center justify-between font-mono text-[11px] tabular-nums">
                        <span>
                          {formatMiliarToTriliun(
                            p.expenditure.total_belanja_miliar
                          )}
                        </span>
                        <span className={st.textClass}>{p.hkpd.score}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div
              ref={containerRef}
              className="h-full w-full"
              aria-label="Peta 3D interaktif APBD 38 provinsi Indonesia dengan basemap CARTO"
            />
          )}

          {/* Floating Editorial Inspection Card */}
          <div className="pointer-events-none absolute left-3 top-3 z-10 w-[268px] rounded-md border border-border bg-card/95 p-3 shadow-md backdrop-blur-sm">
            {hovered ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-sans text-xs font-bold text-foreground">
                    {hovered.name}
                  </span>
                  <Badge variant={hovered.grade} className="font-mono text-[10px] tabular-nums">
                    {hovered.hkpd_score}
                  </Badge>
                </div>
                <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                  Kode {hovered.province_code} • {hovered.island}
                  {hovered.kab_kota_count > 0
                    ? ` • ${hovered.kab_kota_count} Kab/Kota`
                    : ""}
                </p>
                <div className="grid grid-cols-2 gap-1.5 pt-1 font-mono text-[11px] tabular-nums">
                  <div className="rounded border border-border/70 bg-muted/50 px-2 py-1">
                    <span className="block text-[9px] uppercase text-muted-foreground">
                      APBD TA 2025
                    </span>
                    <strong className="text-foreground">
                      Rp {formatNumberId(hovered.total_apbd_triliun, 2)} T
                    </strong>
                  </div>
                  <div className="rounded border border-border/70 bg-muted/50 px-2 py-1">
                    <span className="block text-[9px] uppercase text-muted-foreground">
                      Pegawai / Modal
                    </span>
                    <strong className="text-foreground">
                      {hovered.pegawai_pct}% / {hovered.modal_pct}%
                    </strong>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-0.5 font-mono text-[10px] text-muted-foreground tabular-nums">
                  <span>Serapan: {hovered.serapan_belanja_pct}%</span>
                  <span>
                    IPM BPS: {hovered.ipm !== null ? hovered.ipm : "N/A"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Daerah Terpilih
                </p>
                <p className="font-sans text-xs font-bold text-foreground">
                  {selectedRegion.name}
                </p>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Arahkan kursor ke poligon 3D provinsi untuk menyorot elevasi
                  &amp; postur APBD, atau klik untuk mengaudit.
                </p>
              </div>
            )}
          </div>

          {/* Floating Cartographic Legend Bottom-Left */}
          <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex flex-wrap items-center gap-3 rounded-md border border-border bg-card/95 px-3 py-1.5 font-mono text-[10px] shadow-sm backdrop-blur-sm">
            <span className="flex items-center gap-1.5 font-semibold text-foreground">
              <span className="h-2.5 w-2.5 rounded-[2px] bg-emerald-600" />
              Hijau (≥80)
            </span>
            <span className="flex items-center gap-1.5 font-semibold text-foreground">
              <span className="h-2.5 w-2.5 rounded-[2px] bg-amber-600" />
              Kuning (60–79)
            </span>
            <span className="flex items-center gap-1.5 font-semibold text-foreground">
              <span className="h-2.5 w-2.5 rounded-[2px] bg-red-600" />
              Merah (&lt;60)
            </span>
            <span className="hidden text-muted-foreground sm:inline">
              | Elevasi = Besar APBD
            </span>
          </div>
        </div>

        {/* Interactive Province Click Drill-Down: All Kabupaten/Kota inside Selected Province */}
        {activeProvince && (
          <div className="rounded-md border border-border bg-secondary/35">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <Building2
                  className="h-3.5 w-3.5 shrink-0 text-emerald-700 dark:text-emerald-400"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="truncate font-mono text-[11px] font-bold uppercase tracking-wider text-foreground">
                    Drill-Down: {activeProvince.name}
                  </p>
                  <p className="font-mono text-[10px] text-muted-foreground tabular-nums">
                    {totalKabKotaInProvince > 0
                      ? `${totalKabKotaInProvince} Kabupaten/Kota Otonom — klik untuk langsung audit`
                      : "APBD Provinsi Terpadu (tanpa APBD Kab/Kota terpisah)"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {selectedRegion.id !== activeProvince.id && (
                  <button
                    type="button"
                    onClick={() => onSelectRegion(activeProvince.id)}
                    className="rounded border border-border bg-card px-2 py-1 font-mono text-[10px] font-semibold text-foreground transition-colors hover:border-foreground"
                  >
                    Pemprov {activeProvince.name}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDrawerOpen((v) => !v)}
                  aria-expanded={drawerOpen}
                  aria-label={
                    drawerOpen
                      ? "Ciutkan daftar Kabupaten/Kota"
                      : "Tampilkan daftar Kabupaten/Kota"
                  }
                  className="inline-flex items-center gap-1 rounded border border-border bg-card px-2 py-1 font-mono text-[10px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
                >
                  {drawerOpen ? (
                    <>
                      Tutup
                      <ChevronUp className="h-3 w-3" aria-hidden="true" />
                    </>
                  ) : (
                    <>
                      Daftar ({totalKabKotaInProvince})
                      <ChevronDown className="h-3 w-3" aria-hidden="true" />
                    </>
                  )}
                </button>
              </div>
            </div>

            {drawerOpen && (
              <div className="space-y-2.5 p-3">
                {totalKabKotaInProvince === 0 ? (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    <strong className="text-foreground">
                      {activeProvince.name}
                    </strong>{" "}
                    menerapkan APBD tingkat provinsi terpadu sesuai ketentuan
                    daerah khusus (5 Kota &amp; 1 Kab. Administrasi
                    dikonsolidasikan dalam APBD Provinsi DKI Jakarta).
                  </p>
                ) : (
                  <>
                    {/* Mini filter & sort strip when province has many kab/kota */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {totalKabKotaInProvince > 8 ? (
                        <div className="relative flex-1 min-w-[160px] max-w-[260px]">
                          <Search
                            className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground"
                            aria-hidden="true"
                          />
                          <input
                            type="text"
                            value={drillFilter}
                            onChange={(e) => setDrillFilter(e.target.value)}
                            placeholder={`Saring ${totalKabKotaInProvince} kab/kota...`}
                            aria-label={`Saring kabupaten atau kota di ${activeProvince.name}`}
                            className="h-7 w-full rounded border border-input bg-card pl-7 pr-6 text-[11px] text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          />
                          {drillFilter && (
                            <button
                              type="button"
                              onClick={() => setDrillFilter("")}
                              aria-label="Hapus saringan"
                              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                              <X className="h-3 w-3" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="font-mono text-[10px] text-muted-foreground">
                          Urutkan daftar:
                        </span>
                      )}

                      <div className="flex items-center gap-1 font-mono text-[10px]">
                        {(
                          [
                            { k: "name", l: "A–Z" },
                            { k: "score", l: "Skor" },
                            { k: "apbd", l: "APBD" },
                          ] as const
                        ).map((s) => (
                          <button
                            key={s.k}
                            type="button"
                            onClick={() => setDrillSort(s.k)}
                            className={cn(
                              "rounded px-2 py-0.5 font-semibold transition-colors",
                              drillSort === s.k
                                ? "bg-foreground text-background"
                                : "bg-card text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {s.l}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Interactive Pill Grid for One-Click Kab/Kota Audit */}
                    <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto pr-1">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectRegion(activeProvince.id);
                          if (mapRef.current) {
                            mapRef.current.flyTo({
                              center: activeProvince.centroid,
                              zoom: 5.5,
                              pitch: is3D ? 46 : 0,
                              duration: 750,
                            });
                          }
                        }}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-left font-mono text-[11px] transition-colors",
                          selectedRegion.id === activeProvince.id
                            ? "border-foreground bg-foreground text-background font-semibold"
                            : "border-border bg-card text-foreground hover:border-foreground/60"
                        )}
                      >
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{
                            backgroundColor: getGradeStyles(
                              activeProvince.hkpd.grade
                            ).hex,
                          }}
                        />
                        <span>Pemprov {activeProvince.name}</span>
                        <span className="opacity-75 tabular-nums">
                          {activeProvince.hkpd.score}
                        </span>
                      </button>

                      {provinceKabKota.map((k) => {
                        const isSelected = selectedRegion.id === k.id;
                        const gs = getGradeStyles(k.hkpd.grade);
                        return (
                          <button
                            key={k.id}
                            type="button"
                            onClick={() => {
                              onSelectRegion(k.id);
                              if (mapRef.current) {
                                mapRef.current.flyTo({
                                  center: k.centroid,
                                  zoom: 6.4,
                                  pitch: is3D ? 48 : 0,
                                  duration: 750,
                                });
                              }
                            }}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-left font-mono text-[11px] transition-colors",
                              isSelected
                                ? "border-foreground bg-foreground text-background font-semibold"
                                : "border-border bg-card text-foreground hover:border-foreground/60"
                            )}
                          >
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: gs.hex }}
                            />
                            <span className="max-w-[175px] truncate">
                              {k.name}
                            </span>
                            <span className="opacity-75 tabular-nums">
                              {k.hkpd.score}
                            </span>
                          </button>
                        );
                      })}

                      {provinceKabKota.length === 0 && drillFilter && (
                        <p className="py-1 text-xs text-muted-foreground">
                          Tidak ditemukan kab/kota &ldquo;{drillFilter}&rdquo; di{" "}
                          {activeProvince.name}.
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Keyboard-accessible quick province jumps */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <span className="shrink-0 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Fokus Cepat:
          </span>
          {[
            "prov-31",
            "prov-32",
            "prov-35",
            "prov-64",
            "prov-51",
            "prov-11",
            "prov-53",
            "prov-81",
            "prov-95",
          ].map((pid) => {
            const p = provinces.find((item) => item.id === pid);
            if (!p) return null;
            const active = selectedRegion.province_id === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onSelectRegion(p.id);
                  setDrawerOpen(true);
                  if (mapRef.current) {
                    mapRef.current.flyTo({
                      center: p.centroid,
                      zoom: 5.5,
                      pitch: is3D ? 46 : 0,
                      duration: 800,
                    });
                  }
                }}
                className={`shrink-0 rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors ${
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background text-foreground hover:border-foreground/50"
                }`}
              >
                {p.name}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
