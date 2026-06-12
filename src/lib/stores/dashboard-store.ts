"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AlertMetricConfig,
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
  metricConfigs: AlertMetricConfig[];
  parseStatus: "idle" | "parsing" | "success" | "error";
  parseError?: string;
  setTheme: (theme: DashboardTheme) => void;
  setActiveSection: (section: DashboardSection) => void;
  setActiveDataset: (dataset?: DrillingDataset) => void;
  setParseStatus: (status: DashboardState["parseStatus"], error?: string) => void;
  dismissAlert: (alertId: string) => void;
  resetDismissedAlerts: () => void;
  addMetricConfig: (config: Omit<AlertMetricConfig, "id" | "createdAt">) => void;
  removeMetricConfig: (configId: string) => void;
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
      theme: "light",
      activeSection: "dashboard",
      columnOverrides: {},
      dismissedAlertIds: [],
      metricConfigs: [],
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
      addMetricConfig: (config) =>
        set((state) => ({
          metricConfigs: [
            ...state.metricConfigs,
            {
              ...config,
              id: `${config.datasetKey}:${config.parameter}:${config.min}:${config.max}:${Date.now()}`,
              createdAt: new Date().toISOString(),
            },
          ],
          dismissedAlertIds: [],
        })),
      removeMetricConfig: (configId) =>
        set((state) => ({
          metricConfigs: state.metricConfigs.filter((config) => config.id !== configId),
          dismissedAlertIds: [],
        })),
      visibleAlerts: (alerts) => alerts.filter((alert) => !get().dismissedAlertIds.includes(alert.id)),
      visibleAlertCount: (alerts) => get().visibleAlerts(alerts).length,
    }),
    {
      name: "drill-dashboard-preferences",
      version: 1,
      migrate: (persistedState) => {
        if (!persistedState || typeof persistedState !== "object") {
          return persistedState;
        }

        return {
          ...persistedState,
          theme: (persistedState as { theme?: unknown }).theme === "dark" ? "dark" : "light",
        };
      },
      partialize: (state) => ({
        theme: state.theme,
        activeSection: state.activeSection,
        lastDatasetMeta: state.lastDatasetMeta,
        columnOverrides: state.columnOverrides,
        metricConfigs: state.metricConfigs,
      }),
    },
  ),
);
