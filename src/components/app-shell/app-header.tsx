"use client";

import { Activity, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useDashboardStore } from "@/lib/stores/dashboard-store";

interface AppHeaderProps {
  isHiddenOnMobile: boolean;
  onHiddenOnMobileChange: (hidden: boolean) => void;
  suppressMobileHide?: boolean;
}

export function AppHeader({ isHiddenOnMobile, onHiddenOnMobileChange, suppressMobileHide = false }: AppHeaderProps) {
  const { setTheme: setResolvedTheme } = useTheme();
  const theme = useDashboardStore((state) => state.theme);
  const setTheme = useDashboardStore((state) => state.setTheme);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setResolvedTheme(theme);
  }, [setResolvedTheme, theme]);

  useEffect(() => {
    let previousScrollY = window.scrollY;

    function handleScroll() {
      const currentScrollY = window.scrollY;
      const scrollDelta = currentScrollY - previousScrollY;
      const isDesktopViewport = window.matchMedia("(min-width: 1024px)").matches;
      const isScrollingDown = scrollDelta > 0;
      const focusIsInsideHeader = headerRef.current?.contains(document.activeElement) ?? false;

      previousScrollY = currentScrollY;

      if (Math.abs(scrollDelta) < 8) {
        return;
      }

      onHiddenOnMobileChange(!isDesktopViewport && isScrollingDown && currentScrollY > 80 && !focusIsInsideHeader && !suppressMobileHide);
    }

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, [onHiddenOnMobileChange, suppressMobileHide]);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    setResolvedTheme(nextTheme);
  }

  const ThemeIcon = theme === "dark" ? Moon : Sun;

  return (
    <header
      ref={headerRef}
      data-mobile-hidden={isHiddenOnMobile}
      className="sticky top-0 z-30 flex min-h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur transition-transform duration-200 ease-out supports-[backdrop-filter]:bg-background/80 data-[mobile-hidden=true]:-translate-y-full focus-within:translate-y-0 lg:translate-y-0 lg:px-6"
      onFocusCapture={() => onHiddenOnMobileChange(false)}
    >
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
