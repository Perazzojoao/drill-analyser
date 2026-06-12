import { PARAMETER_DEFINITIONS } from "@/lib/drilling/aliases";
import { filterMetricConfigsForDataset } from "@/lib/drilling/metric-configs";
import type {
  AlertMetricConfig,
  AlertNotification,
  AnomalyFinding,
  DrillingDataset,
  DrillingMeasurement,
} from "@/lib/drilling/types";
import { createDeterministicTimestamp, createStableId } from "@/lib/utils";

export interface DrillingAnalysisResult {
  findings: AnomalyFinding[];
  alerts: AlertNotification[];
}

export function analyzeDrillingDataset(
  dataset: DrillingDataset,
  metricConfigs: AlertMetricConfig[] = [],
): DrillingAnalysisResult {
  const findings = configuredRangeFindings(dataset, metricConfigs);
  const alerts = findings.map((finding) => findingToAlert(finding, dataset));

  return { findings, alerts };
}

function configuredRangeFindings(dataset: DrillingDataset, metricConfigs: AlertMetricConfig[]): AnomalyFinding[] {
  return filterMetricConfigsForDataset(metricConfigs, dataset)
    .filter((config) => config.min <= config.max)
    .flatMap((config) => {
      const definition = PARAMETER_DEFINITIONS[config.parameter];

      return dataset.measurements.flatMap((measurement) => {
        const value = numericValue(measurement, config.parameter);
        if (value === undefined || (value >= config.min && value <= config.max)) return [];

        return [
          {
            id: createStableId(dataset.id, "configured-range", config.id, measurement.index),
            datasetId: dataset.id,
            parameter: config.parameter,
            axisValue: measurement.axisValue,
            rowIndex: measurement.index,
            severity: value < config.min ? "critical" : "warning",
            rule: "configured-range",
            reason: `${definition.label} value ${value} is outside your configured ${config.min}-${config.max}${config.unit ? ` ${config.unit}` : ""} range.`,
            supportingValue: value,
          } satisfies AnomalyFinding,
        ];
      });
    });
}

function numericValue(measurement: DrillingMeasurement, parameter: string): number | undefined {
  const value = measurement.values[parameter];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function findingToAlert(finding: AnomalyFinding, dataset: DrillingDataset): AlertNotification {
  return {
    id: finding.id,
    datasetId: dataset.id,
    title: alertTitle(finding),
    message: alertMessage(finding, dataset),
    severity: finding.severity,
    rule: finding.rule,
    parameter: finding.parameter,
    rowIndex: finding.rowIndex,
    dismissed: false,
    createdAt: createDeterministicTimestamp(),
  };
}

function alertTitle(finding: AnomalyFinding): string {
  const parameterLabel = finding.parameter ? PARAMETER_DEFINITIONS[finding.parameter].label : "Dataset";
  return `${parameterLabel} outside configured range`;
}

function alertMessage(finding: AnomalyFinding, dataset: DrillingDataset): string {
  const axisLabel = dataset.axis.canonicalName === "depth" ? "depth" : "time";
  const position = finding.axisValue !== undefined ? ` near ${axisLabel} ${finding.axisValue}${dataset.axis.unit ? ` ${dataset.axis.unit}` : ""}` : "";
  return `${finding.reason}${position}.`;
}
