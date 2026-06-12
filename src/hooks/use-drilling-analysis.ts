"use client";

import { useQuery } from "@tanstack/react-query";
import { analyzeDataset } from "@/lib/api/drilling-client";
import type { AlertMetricConfig, DrillingDataset } from "@/lib/drilling/types";

export function useDrillingAnalysis(dataset?: DrillingDataset, metricConfigs: AlertMetricConfig[] = []) {
  return useQuery({
    queryKey: ["drilling", "analysis", dataset?.id, metricConfigs],
    queryFn: () => {
      if (!dataset) throw new Error("No dataset is available for analysis.");
      return analyzeDataset(dataset, metricConfigs);
    },
    enabled: Boolean(dataset),
    retry: 1,
    staleTime: 30_000,
  });
}
