"use client";

import { Check, Edit2, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PARAMETER_DEFINITIONS } from "@/lib/drilling/aliases";
import { datasetMetricConfigKey } from "@/lib/drilling/metric-configs";
import type { AlertMetricConfig, CanonicalParameter, DrillingDataset } from "@/lib/drilling/types";

interface AlertMetricConfigManagerProps {
  configs: AlertMetricConfig[];
  activeDataset?: DrillingDataset;
  onUpdateConfig: (configId: string, updates: Pick<AlertMetricConfig, "parameter" | "min" | "max" | "unit">) => void;
  onRemoveConfig: (configId: string) => void;
  onRemoveDatasetConfigs: (datasetKey: string) => void;
}

interface EditableConfigState {
  parameter: CanonicalParameter;
  min: string;
  max: string;
  unit: string;
}

const editableParameters = Object.values(PARAMETER_DEFINITIONS).filter((definition) => definition.role === "parameter");

type DatasetConfigGroup = {
  datasetKey: string;
  label: string;
  metadata: string;
  configs: AlertMetricConfig[];
};

export function AlertMetricConfigManager({
  configs,
  activeDataset,
  onUpdateConfig,
  onRemoveConfig,
  onRemoveDatasetConfigs,
}: AlertMetricConfigManagerProps) {
  const [editingConfigId, setEditingConfigId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditableConfigState | null>(null);
  const groupedConfigs = useMemo(() => groupConfigsByDataset(configs), [configs]);
  const editingGroup = useMemo(
    () => groupedConfigs.find((group) => group.configs.some((config) => config.id === editingConfigId)),
    [editingConfigId, groupedConfigs],
  );
  const trimmedMin = draft?.min.trim() ?? "";
  const trimmedMax = draft?.max.trim() ?? "";
  const parsedMin = Number(trimmedMin);
  const parsedMax = Number(trimmedMax);
  const hasRangeValues = trimmedMin.length > 0 && trimmedMax.length > 0;
  const hasDuplicateParameter = Boolean(
    draft && editingConfigId && editingGroup?.configs.some((config) => config.id !== editingConfigId && config.parameter === draft.parameter),
  );
  const canSave = Boolean(draft) && hasRangeValues && Number.isFinite(parsedMin) && Number.isFinite(parsedMax) && parsedMin <= parsedMax && !hasDuplicateParameter;

  const beginEdit = (config: AlertMetricConfig) => {
    setEditingConfigId(config.id);
    setDraft({
      parameter: config.parameter,
      min: String(config.min),
      max: String(config.max),
      unit: config.unit ?? "",
    });
  };

  const cancelEdit = () => {
    setEditingConfigId(null);
    setDraft(null);
  };

  const saveEdit = (configId: string) => {
    if (!draft || !canSave) return;

    onUpdateConfig(configId, {
      parameter: draft.parameter,
      min: parsedMin,
      max: parsedMax,
      unit: draft.unit.trim() || undefined,
    });
    cancelEdit();
  };

  const confirmRemoveDatasetConfigs = (group: DatasetConfigGroup) => {
    const confirmed = window.confirm(`Delete all ${group.configs.length} stored metric configs for ${group.label}? This cannot be undone.`);

    if (confirmed) {
      onRemoveDatasetConfigs(group.datasetKey);
    }
  };

  return (
    <Dialog onOpenChange={(open) => !open && cancelEdit()}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          View stored metrics
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Stored Alert Metric Configs</DialogTitle>
          <DialogDescription>
            View, edit, or delete every locally stored alert metric grouped by dataset, including datasets that are not currently loaded.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh] pr-4">
          <div className="space-y-4">
            {configs.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                No stored alert metrics were found in this browser.
              </div>
            ) : null}
            {groupedConfigs.map((group) => (
              <div key={group.datasetKey} className="space-y-3 rounded-lg border p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="font-medium">{group.label}</h3>
                    <p className="break-all text-sm text-muted-foreground">{group.metadata}</p>
                    <p className="text-sm text-muted-foreground">
                      {group.configs.length} {group.configs.length === 1 ? "metric" : "metrics"} stored for this dataset.
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => confirmRemoveDatasetConfigs(group)}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Delete dataset metrics
                  </Button>
                </div>
                <div className="space-y-2">
                  {group.configs.map((config) => {
                    const isEditing = editingConfigId === config.id;
                    const parameterOptions = getParameterOptions(group, config, activeDataset);

                    return (
                      <div key={config.id} className="rounded-lg border p-3">
                        {isEditing && draft ? (
                          <div className="grid gap-3 lg:grid-cols-[minmax(12rem,1fr)_minmax(7rem,10rem)_minmax(7rem,10rem)_minmax(7rem,10rem)_auto]">
                            <label className="space-y-2">
                              <span className="text-sm font-medium">Parameter</span>
                              <Select value={draft.parameter} onValueChange={(value) => setDraft({ ...draft, parameter: value as CanonicalParameter })}>
                                <SelectTrigger className="w-full bg-background">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {parameterOptions.map((parameter) => (
                                    <SelectItem key={parameter.canonicalName} value={parameter.canonicalName}>
                                      {parameter.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </label>
                            <label className="space-y-2">
                              <span className="text-sm font-medium">Min</span>
                              <Input type="number" value={draft.min} onChange={(event) => setDraft({ ...draft, min: event.target.value })} />
                            </label>
                            <label className="space-y-2">
                              <span className="text-sm font-medium">Max</span>
                              <Input type="number" value={draft.max} onChange={(event) => setDraft({ ...draft, max: event.target.value })} />
                            </label>
                            <label className="space-y-2">
                              <span className="text-sm font-medium">Unit</span>
                              <Input value={draft.unit} onChange={(event) => setDraft({ ...draft, unit: event.target.value })} placeholder="Optional" />
                            </label>
                            <div className="flex items-end gap-2">
                              <Button type="button" size="sm" onClick={() => saveEdit(config.id)} disabled={!canSave}>
                                <Check className="h-4 w-4" aria-hidden="true" />
                                Save
                              </Button>
                              <Button type="button" variant="outline" size="sm" onClick={cancelEdit}>
                                <X className="h-4 w-4" aria-hidden="true" />
                                Cancel
                              </Button>
                            </div>
                            {hasRangeValues && parsedMin > parsedMax ? (
                              <p className="text-sm text-destructive lg:col-span-5">Minimum must be less than or equal to maximum.</p>
                            ) : null}
                            {hasDuplicateParameter ? (
                              <p className="text-sm text-destructive lg:col-span-5">This dataset group already has a metric for the selected parameter.</p>
                            ) : null}
                          </div>
                        ) : (
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="font-medium">{PARAMETER_DEFINITIONS[config.parameter].label}</p>
                              <p className="text-sm text-muted-foreground">
                                Expected range: {config.min}–{config.max}{config.unit ? ` ${config.unit}` : ""}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button type="button" variant="outline" size="sm" onClick={() => beginEdit(config)}>
                                <Edit2 className="h-4 w-4" aria-hidden="true" />
                                Edit
                              </Button>
                              <Button type="button" variant="outline" size="sm" onClick={() => onRemoveConfig(config.id)}>
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function groupConfigsByDataset(configs: AlertMetricConfig[]): DatasetConfigGroup[] {
  const groups = new Map<string, DatasetConfigGroup>();

  configs.forEach((config) => {
    const datasetKey = config.datasetKey || `legacy:${config.datasetId ?? "unknown"}`;
    const existingGroup = groups.get(datasetKey);

    if (existingGroup) {
      existingGroup.configs.push(config);
      return;
    }

    groups.set(datasetKey, {
      datasetKey,
      label: config.datasetLabel ?? datasetLabelFromKey(datasetKey),
      metadata: datasetMetadataFromKey(datasetKey),
      configs: [config],
    });
  });

  return Array.from(groups.values()).sort((first, second) => `${first.label} ${first.metadata}`.localeCompare(`${second.label} ${second.metadata}`));
}

function getParameterOptions(group: DatasetConfigGroup, config: AlertMetricConfig, activeDataset?: DrillingDataset) {
  const activeDatasetParameters = activeDataset && datasetMetricConfigKey(activeDataset) === group.datasetKey
    ? activeDataset.parameters.map((parameter) => parameter.canonicalName)
    : [];
  const inactiveDatasetParameters = group.configs.map((siblingConfig) => siblingConfig.parameter);
  const parameterNames = new Set<CanonicalParameter>([config.parameter, ...(activeDatasetParameters.length > 0 ? activeDatasetParameters : inactiveDatasetParameters)]);

  return editableParameters.filter((parameter) => parameterNames.has(parameter.canonicalName));
}

function datasetLabelFromKey(datasetKey: string): string {
  const metadata = parseDatasetKey(datasetKey);

  return metadata.sourceName ? metadata.sourceName.replace(/[-_]+/g, " ") : datasetKey;
}

function datasetMetadataFromKey(datasetKey: string): string {
  const metadata = parseDatasetKey(datasetKey);
  const metadataParts = [
    metadata.sourceType ? `Source: ${metadata.sourceType}` : undefined,
    metadata.axisName ? `Axis: ${metadata.axisName}` : undefined,
    metadata.rowCount ? `${metadata.rowCount} rows` : undefined,
    `Key: ${datasetKey}`,
  ];

  return metadataParts.filter(Boolean).join(" · ");
}

function parseDatasetKey(datasetKey: string): { sourceType?: string; sourceName?: string; axisName?: string; rowCount?: string } {
  const segments = datasetKey.split(":");
  const sourceType = segments[0];
  const rowCountSegment = segments.at(-1);
  const rowCount = rowCountSegment?.startsWith("rows=") ? rowCountSegment.slice(5) : undefined;
  const axisName = rowCount ? segments.at(-2) : segments.at(-1);
  const sourceNameEndIndex = rowCount ? -2 : -1;
  const sourceName = segments.slice(1, sourceNameEndIndex).join(":");

  return { sourceType, sourceName, axisName, rowCount };
}
