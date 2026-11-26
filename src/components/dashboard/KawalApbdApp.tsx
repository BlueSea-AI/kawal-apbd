"use client";

import * as React from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ScrollytellingHero } from "@/components/hero/ScrollytellingHero";
import {
  KpiBentoStrip,
  NationalQuickStats,
} from "@/components/dashboard/KpiBentoStrip";
import { RegionFilterBar } from "@/components/dashboard/RegionFilterBar";
import { HkpdComplianceCard } from "@/components/dashboard/HkpdComplianceCard";
import { AiAuditorCard } from "@/components/dashboard/AiAuditorCard";
import { SankeyMoneyFlow } from "@/components/dashboard/SankeyMoneyFlow";
import { BpsCorrelationChart } from "@/components/dashboard/BpsCorrelationChart";
import { RegionLeaderboardTable } from "@/components/dashboard/RegionLeaderboardTable";
import { SpatialMap3D } from "@/components/map/SpatialMap3D";
import { StrukBelanjaPajak } from "@/components/receipt/StrukBelanjaPajak";
import { AduEfisiensiDaerah } from "@/components/duel/AduEfisiensiDaerah";
import type {
  HkpdGrade,
  IslandCluster,
  NationalSummary,
  RegionLevel,
  RegionRecord,
} from "@/types/apbd";

interface KawalApbdAppProps {
  regions: RegionRecord[];
  summary: NationalSummary;
}

export function KawalApbdApp({ regions, summary }: KawalApbdAppProps) {
  const [selectedRegionId, setSelectedRegionId] = React.useState<string>(
    regions.find((r) => r.id === "prov-31")?.id ?? regions[0]?.id ?? ""
  );
  const [activeSection, setActiveSection] = React.useState<string>("dashboard");

  // Filters
  const [searchQuery, setSearchQuery] = React.useState("");
  const [levelFilter, setLevelFilter] = React.useState<"semua" | RegionLevel>(
    "semua"
  );
  const [islandFilter, setIslandFilter] = React.useState<
    "Semua" | IslandCluster
  >("Semua");
  const [gradeFilter, setGradeFilter] = React.useState<"semua" | HkpdGrade>(
    "semua"
  );

  const selectedRegion = React.useMemo(
    () => regions.find((r) => r.id === selectedRegionId) ?? regions[0],
    [regions, selectedRegionId]
  );

  const filteredRegions = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const tokens = q ? q.split(/\s+/).filter(Boolean) : [];
    return regions.filter((r) => {
      if (levelFilter !== "semua" && r.level !== levelFilter) return false;
      if (islandFilter !== "Semua" && r.island !== islandFilter) return false;
      if (gradeFilter !== "semua" && r.hkpd.grade !== gradeFilter) return false;
      if (tokens.length > 0) {
        const hay = `${r.name} ${r.province_name ?? ""} ${r.island} ${r.bps_code} ${r.djpk_code} ${r.effectiveness.archetype}`.toLowerCase();
        if (!tokens.every((t) => hay.includes(t))) {
          return false;
        }
      }
      return true;
    });
  }, [regions, searchQuery, levelFilter, islandFilter, gradeFilter]);

  const handleJumpTo = (sectionId: string) => {
    setActiveSection(sectionId);
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Navbar
        activeSection={activeSection}
        fiscalYear={summary.fiscal_year}
        onJumpTo={handleJumpTo}
      />

      <main className="flex-1">
        {/* Editorial Front-Page Fiscal Brief */}
        <ScrollytellingHero
          regions={regions}
          summary={summary}
          onSelectRegion={setSelectedRegionId}
          onJumpTo={handleJumpTo}
        />

        {/* Main Institutional Fiscal Bento Workspace */}
        <div
          id="dashboard"
          className="scroll-mt-20 mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8"
        >
          {/* National Snapshot Bar */}
          <NationalQuickStats summary={summary} />

          {/* Unified Region Picker & Filter Controls */}
          <RegionFilterBar
            regions={regions}
            selectedRegionId={selectedRegion.id}
            onSelectRegion={setSelectedRegionId}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            levelFilter={levelFilter}
            onLevelChange={setLevelFilter}
            islandFilter={islandFilter}
            onIslandChange={setIslandFilter}
            gradeFilter={gradeFilter}
            onGradeChange={setGradeFilter}
            filteredCount={filteredRegions.length}
          />

          {/* Bento Row 1: 4 Tabular KPI Cards */}
          <KpiBentoStrip region={selectedRegion} summary={summary} />

          {/* Bento Row 2: Authentic 3D Spatial Map (7 cols) + Fiscal Compliance Audit (5 cols) */}
          <section
            id="peta-3d"
            className="scroll-mt-20 grid grid-cols-1 gap-6 lg:grid-cols-12"
          >
            <div className="lg:col-span-7">
              <SpatialMap3D
                regions={regions}
                selectedRegion={selectedRegion}
                fiscalYear={summary.fiscal_year}
                onSelectRegion={setSelectedRegionId}
              />
            </div>
            <div className="lg:col-span-5">
              <HkpdComplianceCard region={selectedRegion} />
            </div>
          </section>

          {/* Bento Row 3: Exact DJPK Sankey Money Flow (7 cols) + Verified Audit Summary (5 cols) */}
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <SankeyMoneyFlow region={selectedRegion} />
            </div>
            <div className="lg:col-span-5">
              <AiAuditorCard region={selectedRegion} />
            </div>
          </section>

          {/* Bento Row 4: BPS Cross-Data Correlation Scatter Matrix */}
          <section>
            <BpsCorrelationChart
              regions={filteredRegions.length > 0 ? filteredRegions : regions}
              selectedRegionId={selectedRegion.id}
              fiscalYear={summary.fiscal_year}
              onSelectRegion={setSelectedRegionId}
            />
          </section>

          {/* Citizen Feature 1: Struk Belanja Pajak PNG Generator */}
          <StrukBelanjaPajak
            regions={regions}
            defaultRegionId={selectedRegion.id}
          />

          {/* Citizen Feature 2: Adu Efisiensi Daerah 1v1 */}
          <AduEfisiensiDaerah
            regions={regions}
            defaultRegionAId={selectedRegion.id}
          />

          {/* Bento Row 5: Full Sortable, Paginated Audit Leaderboard Table */}
          <section id="direktori-daerah" className="scroll-mt-20">
            <RegionLeaderboardTable
              regions={filteredRegions}
              allRegions={regions}
              fiscalYear={summary.fiscal_year}
              selectedRegionId={selectedRegion.id}
              onSelectRegion={(id) => {
                setSelectedRegionId(id);
                handleJumpTo("dashboard");
              }}
            />
          </section>
        </div>
      </main>

      <Footer summary={summary} />
    </div>
  );
}
