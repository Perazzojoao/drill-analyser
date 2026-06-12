"use client";

import { Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PARAMETER_DEFINITIONS } from "@/lib/drilling/aliases";
import { datasetMetricConfigKey } from "@/lib/drilling/metric-configs";
import type { AlertMetricConfig, CanonicalParameter, DrillingDataset } from "@/lib/drilling/types";

interface AlertMetricConfiguratorProps {
  dataset: DrillingDataset;
  configs: AlertMetricConfig[];
  onAddConfig: (config: Omit<AlertMetricConfig, "id" | "createdAt">) => void;
  onRemoveConfig: (configId: string) => void;
  storedMetricsAction?: ReactNode;
}

export function AlertMetricConfigurator({ dataset, configs, onAddConfig, onRemoveConfig, storedMetricsAction }: AlertMetricConfiguratorProps) {
  const availableParameters = useMemo(() => {
    const configuredParameters = new Set(configs.map((config) => config.parameter));
    return dataset.parameters.filter((parameter) => !configuredParameters.has(parameter.canonicalName));
  }, [configs, dataset.parameters]);
  const [parameter, setParameter] = useState<CanonicalParameter | "">(availableParameters[0]?.canonicalName ?? "");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");

  const activeParameter = parameter && availableParameters.some((candidate) => candidate.canonicalName === parameter)
    ? parameter
    : availableParameters[0]?.canonicalName ?? "";
  const selectedParameter = dataset.parameters.find((candidate) => candidate.canonicalName === activeParameter);
  const trimmedMin = min.trim();
  const trimmedMax = max.trim();
  const parsedMin = Number(trimmedMin);
  const parsedMax = Number(trimmedMax);
  const hasConfigurableParameters = availableParameters.length > 0;
  const hasRangeValues = trimmedMin.length > 0 && trimmedMax.length > 0;
  const canAdd = hasConfigurableParameters && Boolean(activeParameter) && hasRangeValues && Number.isFinite(parsedMin) && Number.isFinite(parsedMax) && parsedMin <= parsedMax;

  const handleAdd = () => {
    if (!canAdd || !activeParameter) return;

    onAddConfig({
      datasetKey: datasetMetricConfigKey(dataset),
      datasetId: dataset.id,
      datasetLabel: dataset.sourceName,
      parameter: activeParameter,
      min: parsedMin,
      max: parsedMax,
      unit: selectedParameter?.unit,
    });
    setParameter(availableParameters.find((candidate) => candidate.canonicalName !== activeParameter)?.canonicalName ?? "");
    setMin("");
    setMax("");
  };

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle>Alert Metrics</CardTitle>
          <CardDescription>
            Add user-defined min/max ranges for parameters in the current dataset. Alerts are generated only from these configured ranges.
          </CardDescription>
        </div>
        {storedMetricsAction}
      </CardHeader>
      <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(12rem,1fr)_minmax(8rem,12rem)_minmax(8rem,12rem)_auto]">
            <label className="space-y-2">
              <span className="text-sm font-medium">Parameter</span>
              <Select value={activeParameter} onValueChange={(value) => setParameter(value as CanonicalParameter)} disabled={availableParameters.length === 0}>
                <SelectTrigger className="w-full bg-background">
                  <SelectValue placeholder="Select a parameter" />
                </SelectTrigger>
                <SelectContent>
                  {availableParameters.map((candidate) => (
                    <SelectItem key={candidate.canonicalName} value={candidate.canonicalName}>
                      {PARAMETER_DEFINITIONS[candidate.canonicalName].label}{candidate.unit ? ` (${candidate.unit})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Min</span>
              <Input type="number" value={min} onChange={(event) => setMin(event.target.value)} placeholder="Minimum" disabled={!hasConfigurableParameters} />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Max</span>
              <Input type="number" value={max} onChange={(event) => setMax(event.target.value)} placeholder="Maximum" disabled={!hasConfigurableParameters} />
            </label>
            <div className="flex items-end">
              <Button type="button" className="w-full" onClick={handleAdd} disabled={!canAdd}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add metric
              </Button>
            </div>
          </div>
          {hasRangeValues && parsedMin > parsedMax ? (
            <p className="text-sm text-destructive">Minimum must be less than or equal to maximum.</p>
          ) : null}
          {configs.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No alert metrics configured. Add metrics to start visualizing alerts.
            </div>
          ) : null}
          {configs.length > 0 && availableParameters.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              All current dataset parameters already have alert metrics. Remove a metric below to change or recreate its range.
            </div>
          ) : null}
          {configs.length > 0 ? (
            <div className="space-y-2">
              {configs.map((config) => (
                <div key={config.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">{PARAMETER_DEFINITIONS[config.parameter].label}</p>
                    <p className="text-sm text-muted-foreground">
                      Expected range: {config.min}–{config.max}{config.unit ? ` ${config.unit}` : ""}
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => onRemoveConfig(config.id)}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
      </CardContent>
    </Card>
  );
}
