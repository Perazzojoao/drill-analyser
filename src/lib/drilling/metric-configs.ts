import type { AlertMetricConfig, DrillingDataset } from "@/lib/drilling/types";

export const MAX_ALERT_METRIC_CONFIG_COUNT = 24;

export function datasetMetricConfigKey(dataset: DrillingDataset): string {
  return `${datasetMetricConfigScope(dataset)}:rows=${dataset.rowCount}`;
}

export function datasetMetricConfigScope(dataset: DrillingDataset): string {
  return `${dataset.sourceType}:${datasetIdentity(dataset)}:${dataset.axis.canonicalName}`;
}

export function filterMetricConfigsForDataset(configs: AlertMetricConfig[], dataset: DrillingDataset): AlertMetricConfig[] {
  const datasetKey = datasetMetricConfigKey(dataset);
  const datasetScope = datasetMetricConfigScope(dataset);
  const availableParameters = new Set(dataset.parameters.map((parameter) => parameter.canonicalName));

  return configs.flatMap((config) => {
    if (!metricConfigMatchesDataset(config, datasetKey, datasetScope, dataset.id)) return [];
    if (!availableParameters.has(config.parameter)) return [];

    return [{ ...config, datasetKey }];
  });
}

function datasetIdentity(dataset: DrillingDataset): string {
  return (dataset.sourceType === "mock" ? dataset.id : dataset.sourceName).trim().toLowerCase();
}

function metricConfigMatchesDataset(config: AlertMetricConfig, datasetKey: string, datasetScope: string, datasetId: string): boolean {
  if (!config.datasetKey) return config.datasetId === datasetId;
  if (config.datasetKey === datasetKey) return true;

  const legacySuffix = config.datasetKey.startsWith(`${datasetScope}:`)
    ? config.datasetKey.slice(datasetScope.length + 1)
    : undefined;

  return config.datasetKey === datasetScope || Boolean(legacySuffix && !legacySuffix.startsWith("rows="));
}
