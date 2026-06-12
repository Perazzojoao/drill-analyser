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
  updateMetricConfig: (configId: string, updates: Pick<AlertMetricConfig, "parameter" | "min" | "max" | "unit">) => void;
  removeMetricConfig: (configId: string) => void;
  removeMetricConfigsForDataset: (datasetKey: string) => void;
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

function datasetGroupingKey(config: AlertMetricConfig): string {
  return config.datasetKey || `legacy:${config.datasetId ?? "unknown"}`;
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
      updateMetricConfig: (configId, updates) =>
        set((state) => {
          const existingConfig = state.metricConfigs.find((config) => config.id === configId);
          const hasDuplicateParameter = existingConfig
            ? state.metricConfigs.some(
                (config) => config.id !== configId && datasetGroupingKey(config) === datasetGroupingKey(existingConfig) && config.parameter === updates.parameter,
              )
            : false;

          if (!existingConfig || hasDuplicateParameter) {
            return state;
          }

          return {
            metricConfigs: state.metricConfigs.map((config) => (config.id === configId ? { ...config, ...updates } : config)),
            dismissedAlertIds: [],
          };
        }),
      removeMetricConfig: (configId) =>
        set((state) => ({
          metricConfigs: state.metricConfigs.filter((config) => config.id !== configId),
          dismissedAlertIds: [],
        })),
      removeMetricConfigsForDataset: (datasetKey) =>
        set((state) => ({
          metricConfigs: state.metricConfigs.filter((config) => datasetGroupingKey(config) !== datasetKey),
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
