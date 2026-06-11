"use client";

import { Activity, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useDashboardStore } from "@/lib/stores/dashboard-store";

export function AppHeader() {
  const { setTheme: setResolvedTheme } = useTheme();
  const theme = useDashboardStore((state) => state.theme);
  const setTheme = useDashboardStore((state) => state.setTheme);

  useEffect(() => {
    setResolvedTheme(theme);
  }, [setResolvedTheme, theme]);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    setResolvedTheme(nextTheme);
  }

  const ThemeIcon = theme === "dark" ? Moon : Sun;

  return (
    <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:px-6">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="hidden lg:inline-flex" />
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Activity className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Drilling operations</p>
          <h1 className="text-lg font-semibold tracking-tight">Drill Data Dashboard</h1>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode.`}>
        <ThemeIcon className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">{theme === "dark" ? "Dark" : "Light"}</span>
      </Button>
    </header>
  );
}
