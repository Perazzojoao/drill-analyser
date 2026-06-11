"use client";

import { AlertTriangle, BarChart3, Upload, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarSeparator, useSidebar } from "@/components/ui/sidebar";
import type { DashboardSection, NavigationItem } from "@/lib/drilling/types";
import { useDashboardStore } from "@/lib/stores/dashboard-store";
import { cn } from "@/lib/utils";

export const SECTION_LABELS: Record<DashboardSection, string> = {
  dashboard: "Dashboard",
  upload: "Upload/Data Preview",
  alerts: "Alerts",
};

export type NavigationItemWithIcon = NavigationItem & { icon: LucideIcon };

export const NAVIGATION_ITEMS: Array<Omit<NavigationItemWithIcon, "active" | "badgeCount">> = [
  { id: "dashboard", label: SECTION_LABELS.dashboard, href: "#dashboard", icon: BarChart3 },
  { id: "upload", label: SECTION_LABELS.upload, href: "#upload", icon: Upload },
  { id: "alerts", label: SECTION_LABELS.alerts, href: "#alerts", icon: AlertTriangle },
];

export function buildNavigationItems(activeSection: DashboardSection, alertCount: number): NavigationItemWithIcon[] {
  return NAVIGATION_ITEMS.map((item) => ({
    ...item,
    active: activeSection === item.id,
    badgeCount: item.id === "alerts" && alertCount > 0 ? alertCount : undefined,
  }));
}

interface AppSidebarProps {
  alertCount?: number;
}

export function AppSidebar({ alertCount = 0 }: AppSidebarProps) {
  const activeSection = useDashboardStore((state) => state.activeSection);
  const setActiveSection = useDashboardStore((state) => state.setActiveSection);
  const lastDatasetMeta = useDashboardStore((state) => state.lastDatasetMeta);

  return (
    <Sidebar className="hidden lg:flex">
      <SidebarHeader>
        <div className="group-data-[state=collapsed]:sr-only">
          <p className="text-sm font-medium">Workspace</p>
          <p className="text-xs text-muted-foreground">Local session only</p>
        </div>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        {buildNavigationItems(activeSection, alertCount).map((item) => (
          <SidebarButton key={item.id} item={item} onSelect={setActiveSection} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <div className="group-data-[state=collapsed]:sr-only">
          <p className="text-xs text-muted-foreground">Dataset</p>
          <p className="truncate text-sm font-medium">{lastDatasetMeta?.sourceName ?? "Sample dataset loading"}</p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function SidebarButton({ item, onSelect }: { item: NavigationItemWithIcon; onSelect: (section: DashboardSection) => void }) {
  const Icon = item.icon;
  const { open } = useSidebar();
  const alertBadgeLabel = item.badgeCount
    ? `${item.label}, ${item.badgeCount} active ${item.badgeCount === 1 ? "alert" : "alerts"}`
    : item.label;

  return (
    <Button
      type="button"
      variant="ghost"
      size={open ? "default" : "icon"}
      className={cn("w-full justify-start", !open && "relative justify-center", item.active && "bg-sidebar-accent text-sidebar-accent-foreground")}
      onClick={() => onSelect(item.id)}
      aria-current={item.active ? "page" : undefined}
      aria-label={!open ? alertBadgeLabel : undefined}
      title={!open ? alertBadgeLabel : undefined}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {open ? <span className="flex-1 text-left">{item.label}</span> : <span className="sr-only">{alertBadgeLabel}</span>}
      {open && item.badgeCount ? <span className="rounded-full bg-warning px-2 py-0.5 text-xs text-foreground">{item.badgeCount}</span> : null}
      {!open && item.badgeCount ? (
        <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-warning px-1 text-[10px] leading-4 text-foreground" aria-hidden="true">
          {item.badgeCount}
        </span>
      ) : null}
    </Button>
  );
}
