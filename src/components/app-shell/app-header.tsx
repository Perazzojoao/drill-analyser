"use client";

import { Activity, Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useDashboardStore } from "@/lib/stores/dashboard-store";
import type { DashboardTheme } from "@/lib/drilling/types";

const THEME_ORDER: DashboardTheme[] = ["light", "dark", "system"];

export function AppHeader() {
  const { setTheme: setResolvedTheme } = useTheme();
  const theme = useDashboardStore((state) => state.theme);
  const setTheme = useDashboardStore((state) => state.setTheme);

  useEffect(() => {
    setResolvedTheme(theme);
  }, [setResolvedTheme, theme]);

  function cycleTheme() {
    const nextTheme = THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length];
    setTheme(nextTheme);
    setResolvedTheme(nextTheme);
  }

  const ThemeIcon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  return (
    <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:px-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Activity className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Drilling operations</p>
          <h1 className="text-lg font-semibold tracking-tight">Drill Data Dashboard</h1>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={cycleTheme} aria-label={`Current theme ${theme}. Switch theme.`}>
        <ThemeIcon className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">{theme}</span>
      </Button>
    </header>
  );
}
