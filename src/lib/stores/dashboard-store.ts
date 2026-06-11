"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AlertNotification,
  CompactDatasetMeta,
  DashboardPreferences,
  DashboardSection,
  DashboardTheme,
  DrillingDataset,
} from "@/lib/drilling/types";

interface DashboardState extends DashboardPreferences {
  activeDataset?: DrillingDataset;
  uploadedDataset?: DrillingDataset;
  dismissedAlertIds: string[];
  parseStatus: "idle" | "parsing" | "success" | "error";
  parseError?: string;
  setTheme: (theme: DashboardTheme) => void;
  setActiveSection: (section: DashboardSection) => void;
  setActiveDataset: (dataset?: DrillingDataset) => void;
  setParseStatus: (status: DashboardState["parseStatus"], error?: string) => void;
  dismissAlert: (alertId: string) => void;
  resetDismissedAlerts: () => void;
  visibleAlerts: (alerts: AlertNotification[]) => AlertNotification[];
  visibleAlertCount: (alerts: AlertNotification[]) => number;
}

function toCompactDatasetMeta(dataset: DrillingDataset): CompactDatasetMeta {
  return {
    id: dataset.id,
    sourceType: dataset.sourceType,
    sourceName: dataset.sourceName,
    loadedAt: dataset.loadedAt,
    rowCount: dataset.rowCount,
    sizeBytes: dataset.sizeBytes,
    isSample: dataset.isSample,
  };
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      theme: "system",
      activeSection: "dashboard",
      columnOverrides: {},
      dismissedAlertIds: [],
      parseStatus: "idle",
      setTheme: (theme) => set({ theme }),
      setActiveSection: (activeSection) => set({ activeSection }),
      setActiveDataset: (dataset) =>
        set({
          activeDataset: dataset,
          uploadedDataset: dataset?.sourceType === "uploaded" ? dataset : get().uploadedDataset,
          lastDatasetMeta: dataset ? toCompactDatasetMeta(dataset) : undefined,
          dismissedAlertIds: [],
          parseStatus: dataset ? "success" : "idle",
          parseError: undefined,
        }),
      setParseStatus: (parseStatus, parseError) => set({ parseStatus, parseError }),
      dismissAlert: (alertId) =>
        set((state) => ({
          dismissedAlertIds: state.dismissedAlertIds.includes(alertId)
            ? state.dismissedAlertIds
            : [...state.dismissedAlertIds, alertId],
        })),
      resetDismissedAlerts: () => set({ dismissedAlertIds: [] }),
      visibleAlerts: (alerts) => alerts.filter((alert) => !get().dismissedAlertIds.includes(alert.id)),
      visibleAlertCount: (alerts) => get().visibleAlerts(alerts).length,
    }),
    {
      name: "drill-dashboard-preferences",
      partialize: (state) => ({
        theme: state.theme,
        activeSection: state.activeSection,
        lastDatasetMeta: state.lastDatasetMeta,
        columnOverrides: state.columnOverrides,
      }),
    },
  ),
);
