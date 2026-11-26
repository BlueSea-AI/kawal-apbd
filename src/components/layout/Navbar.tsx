"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import {
  Landmark,
  Sun,
  Moon,
  Map as MapIcon,
  Receipt,
  Swords,
  BarChart3,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NavbarProps {
  activeSection: string;
  fiscalYear: number;
  onJumpTo: (sectionId: string) => void;
}

const NAV_ITEMS = [
  { id: "dashboard", label: "Audit Bento", icon: BarChart3 },
  { id: "peta-3d", label: "Peta 3D", icon: MapIcon },
  { id: "struk-pajak", label: "Struk Pajak", icon: Receipt },
  { id: "adu-daerah", label: "Adu 1v1", icon: Swords },
];

export function Navbar({ activeSection, fiscalYear, onJumpTo }: NavbarProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Institutional Editorial Brand Lockup */}
        <button
          type="button"
          onClick={() => onJumpTo("hero")}
          className="flex shrink-0 items-center gap-2.5 rounded-md py-1 pr-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Kawal APBD — Kembali ke beranda"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-foreground text-background">
            <Landmark className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="whitespace-nowrap font-sans text-sm font-extrabold tracking-tight text-foreground sm:text-base">
                KAWAL APBD
              </span>
              <span className="hidden border-l border-border pl-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:inline-block">
                TA {fiscalYear}
              </span>
            </div>
            <p className="hidden text-[11px] leading-none text-muted-foreground sm:block">
              Audit Fiskal Daerah • DJPK &amp; BPS
            </p>
          </div>
        </button>

        {/* Desktop Navigation — clean editorial tabs, visible from lg (1024px+) to prevent any crowding/clipping */}
        <nav
          aria-label="Navigasi utama"
          className="hidden items-center gap-1 lg:flex"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onJumpTo(item.id)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold transition-colors duration-150",
                  isActive
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Actions — shrink-0 guarantees Cetak Struk never clips at 1280px or 1440px */}
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={toggleTheme}
            aria-label={
              mounted && resolvedTheme === "dark"
                ? "Beralih ke mode terang"
                : "Beralih ke mode gelap"
            }
            className="h-9 w-9 shrink-0"
          >
            {mounted ? (
              resolvedTheme === "dark" ? (
                <Sun className="h-4 w-4 text-amber-400" aria-hidden="true" />
              ) : (
                <Moon className="h-4 w-4 text-foreground" aria-hidden="true" />
              )
            ) : (
              <Moon className="h-4 w-4 opacity-40" aria-hidden="true" />
            )}
          </Button>

          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => onJumpTo("struk-pajak")}
            className="hidden h-9 shrink-0 whitespace-nowrap px-3.5 font-sans text-xs font-semibold sm:inline-flex"
          >
            <Receipt className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Cetak Struk</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Tutup menu navigasi" : "Buka menu navigasi"}
            aria-expanded={mobileOpen}
            className="h-9 w-9 shrink-0 lg:hidden"
          >
            {mobileOpen ? (
              <X className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Menu className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
        </div>
      </div>

      {/* Responsive Mobile & Tablet Drawer (< 1024px) */}
      {mobileOpen && (
        <nav
          aria-label="Navigasi seluler"
          className="border-t border-border bg-card px-4 py-4 shadow-lg lg:hidden"
        >
          <div className="mx-auto max-w-7xl space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onJumpTo(item.id);
                      setMobileOpen(false);
                    }}
                    className={cn(
                      "flex items-center gap-2 rounded-md border px-3 py-2.5 text-sm font-semibold transition-colors",
                      isActive
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background text-foreground hover:bg-secondary"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
            <Button
              type="button"
              variant="default"
              size="default"
              onClick={() => {
                onJumpTo("struk-pajak");
                setMobileOpen(false);
              }}
              className="w-full font-sans text-sm font-semibold sm:hidden"
            >
              <Receipt className="h-4 w-4" aria-hidden="true" />
              Cetak Struk Belanja Pajak
            </Button>
          </div>
        </nav>
      )}
    </header>
  );
}
