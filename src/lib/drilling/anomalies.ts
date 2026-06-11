import { isPercentUnit, PARAMETER_DEFINITIONS } from "@/lib/drilling/aliases";
import type {
  AlertNotification,
  AnomalyFinding,
  DrillingDataset,
  DrillingMeasurement,
  RecognizedColumn,
} from "@/lib/drilling/types";
import { createDeterministicTimestamp, createStableId } from "@/lib/utils";

export interface DrillingAnalysisResult {
  findings: AnomalyFinding[];
  alerts: AlertNotification[];
}

const MISSING_CLUSTER_MIN_LENGTH = 3;
const SPIKE_DROP_MIN_ABSOLUTE_DELTA = 25;
const SPIKE_DROP_RATIO = 2.5;

export function analyzeDrillingDataset(dataset: DrillingDataset): DrillingAnalysisResult {
  const findings = [...fixedRangeFindings(dataset), ...spikeDropFindings(dataset), ...missingClusterFindings(dataset), ...qualityWarningFindings(dataset)];
  const alerts = findings.map((finding) => findingToAlert(finding, dataset));

  return { findings, alerts };
}

function fixedRangeFindings(dataset: DrillingDataset): AnomalyFinding[] {
  return dataset.parameters.flatMap((parameter) => {
    const definition = PARAMETER_DEFINITIONS[parameter.canonicalName];
    if (!definition.range) return [];

    const max = isPercentUnit(parameter.unit) ? definition.range.percentMax ?? definition.range.max : definition.range.max;
    const min = definition.range.min;

    return dataset.measurements.flatMap((measurement) => {
      const value = measurement.values[parameter.canonicalName];
      if (typeof value !== "number" || (value >= min && value <= max)) return [];

      return [
        {
          id: createStableId(dataset.id, "fixed-range", parameter.canonicalName, measurement.index),
          datasetId: dataset.id,
          parameter: parameter.canonicalName,
          axisValue: measurement.axisValue,
          rowIndex: measurement.index,
          severity: value < min ? "critical" : "warning",
          rule: "fixed-range",
          reason: `${definition.label} value ${value} is outside the expected ${min}-${max}${parameter.unit ? ` ${parameter.unit}` : ""} range.`,
          supportingValue: value,
        } satisfies AnomalyFinding,
      ];
    });
  });
}

function spikeDropFindings(dataset: DrillingDataset): AnomalyFinding[] {
  return dataset.parameters.flatMap((parameter) => {
    const values = dataset.measurements
      .map((measurement) => ({ measurement, value: measurement.values[parameter.canonicalName] }))
      .filter((point): point is { measurement: DrillingMeasurement; value: number } => typeof point.value === "number" && Number.isFinite(point.value));

    if (values.length < 3) return [];

    return values.slice(1).flatMap((point, index) => {
      const previous = values[index];
      const delta = Math.abs(point.value - previous.value);
      const baseline = Math.max(Math.min(Math.abs(previous.value), Math.abs(point.value)), 1);
      const isAbrupt = delta >= SPIKE_DROP_MIN_ABSOLUTE_DELTA && delta / baseline >= SPIKE_DROP_RATIO;
      if (!isAbrupt) return [];

      const definition = PARAMETER_DEFINITIONS[parameter.canonicalName];
      const direction = point.value > previous.value ? "spiked" : "dropped";

      return [
        {
          id: createStableId(dataset.id, "spike-drop", parameter.canonicalName, point.measurement.index),
          datasetId: dataset.id,
          parameter: parameter.canonicalName,
          axisValue: point.measurement.axisValue,
          rowIndex: point.measurement.index,
          severity: "warning",
          rule: "spike-drop",
          reason: `${definition.label} ${direction} abruptly from ${previous.value} to ${point.value}.`,
          supportingValue: point.value,
        } satisfies AnomalyFinding,
      ];
    });
  });
}

function missingClusterFindings(dataset: DrillingDataset): AnomalyFinding[] {
  return dataset.parameters.flatMap((parameter) => {
    const clusters: AnomalyFinding[] = [];
    let clusterStart: DrillingMeasurement | undefined;
    let clusterLength = 0;

    for (const measurement of dataset.measurements) {
      if (measurement.values[parameter.canonicalName] === null || measurement.validity[parameter.canonicalName] === "missing") {
        clusterStart ??= measurement;
        clusterLength += 1;
        continue;
      }

      if (clusterStart && clusterLength >= MISSING_CLUSTER_MIN_LENGTH) {
        clusters.push(buildMissingClusterFinding(dataset, parameter, clusterStart, clusterLength));
      }
      clusterStart = undefined;
      clusterLength = 0;
    }

    if (clusterStart && clusterLength >= MISSING_CLUSTER_MIN_LENGTH) {
      clusters.push(buildMissingClusterFinding(dataset, parameter, clusterStart, clusterLength));
    }

    return clusters;
  });
}

function buildMissingClusterFinding(
  dataset: DrillingDataset,
  parameter: RecognizedColumn,
  start: DrillingMeasurement,
  length: number,
): AnomalyFinding {
  const definition = PARAMETER_DEFINITIONS[parameter.canonicalName];

  return {
    id: createStableId(dataset.id, "missing-cluster", parameter.canonicalName, start.index),
    datasetId: dataset.id,
    parameter: parameter.canonicalName,
    axisValue: start.axisValue,
    rowIndex: start.index,
    severity: "warning",
    rule: "missing-cluster",
    reason: `${definition.label} has ${length} consecutive missing values starting at row ${start.index + 1}.`,
    supportingValue: length,
  };
}

function qualityWarningFindings(dataset: DrillingDataset): AnomalyFinding[] {
  return dataset.qualityWarnings.flatMap((warning) => {
    if (!warning.parameter || !["invalid-values", "sparse-data"].includes(warning.type)) return [];

    return [
      {
        id: createStableId(dataset.id, warning.type, warning.parameter, "quality"),
        datasetId: dataset.id,
        parameter: warning.parameter,
        rowIndex: warning.rowIndex,
        severity: warning.severity,
        rule: warning.type,
        reason: warning.message,
        supportingValue: warning.affectedCount,
      } satisfies AnomalyFinding,
    ];
  });
}

function findingToAlert(finding: AnomalyFinding, dataset: DrillingDataset): AlertNotification {
  return {
    id: finding.id,
    datasetId: dataset.id,
    title: alertTitle(finding),
    message: alertMessage(finding, dataset),
    severity: finding.severity,
    dismissed: false,
    createdAt: createDeterministicTimestamp(),
  };
}

function alertTitle(finding: AnomalyFinding): string {
  const parameterLabel = finding.parameter ? PARAMETER_DEFINITIONS[finding.parameter].label : "Dataset";

  switch (finding.rule) {
    case "fixed-range":
      return `${parameterLabel} outside expected range`;
    case "spike-drop":
      return `Abrupt ${parameterLabel} change`;
    case "missing-cluster":
      return `Missing ${parameterLabel} cluster`;
    case "sparse-data":
      return `Sparse ${parameterLabel} data`;
    case "invalid-values":
      return `Invalid ${parameterLabel} values`;
    default:
      return `${parameterLabel} alert`;
  }
}

function alertMessage(finding: AnomalyFinding, dataset: DrillingDataset): string {
  const axisLabel = dataset.axis.canonicalName === "depth" ? "depth" : "time";
  const position = finding.axisValue !== undefined ? ` near ${axisLabel} ${finding.axisValue}${dataset.axis.unit ? ` ${dataset.axis.unit}` : ""}` : "";
  return `${finding.reason}${position}.`;
}
