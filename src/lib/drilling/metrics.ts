import { PARAMETER_DEFINITIONS } from "@/lib/drilling/aliases";
import type { CanonicalParameter, DashboardMetric, DrillingDataset, ParameterChart } from "@/lib/drilling/types";

const DEFAULT_CHART_PARAMETERS: CanonicalParameter[] = ["rop", "wob", "rpm", "phif", "vsh", "sw", "klogh"];

function numericValues(dataset: DrillingDataset, parameter: CanonicalParameter): number[] {
  return dataset.measurements
    .map((measurement) => measurement.values[parameter])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

function average(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function depthCoverage(dataset: DrillingDataset): number | undefined {
  if (dataset.axis.canonicalName !== "depth") return undefined;
  const depths = dataset.measurements
    .map((measurement) => measurement.axisValue)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (depths.length < 2) return undefined;
  return Number((Math.max(...depths) - Math.min(...depths)).toFixed(2));
}

function parameterUnit(dataset: DrillingDataset, parameter: CanonicalParameter): string | undefined {
  return dataset.parameters.find((column) => column.canonicalName === parameter)?.unit;
}

export function calculateDashboardMetrics(dataset: DrillingDataset, alertCount = dataset.qualityWarnings.length): DashboardMetric[] {
  const metrics: DashboardMetric[] = [];
  const coverage = depthCoverage(dataset);
  const avgRop = average(numericValues(dataset, "rop"));
  const avgWob = average(numericValues(dataset, "wob"));

  metrics.push({
    id: "depth-coverage",
    label: dataset.axis.canonicalName === "depth" ? "Depth Coverage" : "Time Samples",
    value: coverage ?? dataset.measurements.length,
    unit: coverage !== undefined ? dataset.axis.unit : "rows",
    description: coverage !== undefined ? "Range covered by the active dataset." : "Number of loaded chart samples.",
    source: dataset.sourceType,
    severity: "neutral",
  });

  metrics.push({
    id: "avg-rop",
    label: "Average ROP",
    value: avgRop ?? "Unavailable",
    unit: avgRop !== undefined ? parameterUnit(dataset, "rop") : undefined,
    description: avgRop !== undefined ? "Mean rate of penetration from usable values." : "ROP was not recognized or has no usable values.",
    source: dataset.sourceType,
    severity: avgRop !== undefined ? "neutral" : "info",
  });

  metrics.push({
    id: "avg-wob",
    label: "Average WOB",
    value: avgWob ?? "Unavailable",
    unit: avgWob !== undefined ? parameterUnit(dataset, "wob") : undefined,
    description: avgWob !== undefined ? "Mean weight on bit from usable values." : "WOB was not recognized or has no usable values.",
    source: dataset.sourceType,
    severity: avgWob !== undefined ? "neutral" : "info",
  });

  metrics.push({
    id: "configured-alert-count",
    label: "Configured Alerts",
    value: alertCount,
    description: alertCount === 0 ? "No configured-range alerts detected." : "Configured-range alerts available for review.",
    source: dataset.sourceType,
    severity: alertCount > 0 ? "warning" : "neutral",
  });

  return metrics;
}

export function buildParameterCharts(dataset: DrillingDataset, maxPoints = 600): ParameterChart[] {
  const chartableColumns = dataset.parameters.filter((column) => numericValues(dataset, column.canonicalName).length > 0);

  if (chartableColumns.length === 0) {
    return [
      {
        id: "chart-unavailable",
        title: "No chartable parameters",
        axisLabel: axisLabel(dataset),
        series: [],
        highlightedFindings: [],
        emptyReason: "No chartable drilling parameters are available.",
      },
    ];
  }

  return DEFAULT_CHART_PARAMETERS.filter((parameter) => chartableColumns.some((column) => column.canonicalName === parameter)).map(
    (parameter) => {
      const definition = PARAMETER_DEFINITIONS[parameter];
      const column = chartableColumns.find((candidate) => candidate.canonicalName === parameter);

      return {
        id: `chart-${parameter}`,
        title: `${definition.label} by ${dataset.axis.canonicalName === "depth" ? "Depth" : "Time"}`,
        axisLabel: axisLabel(dataset),
        highlightedFindings: [],
        series: [
          {
            parameter,
            label: definition.label,
            unit: column?.unit,
            points: downsample(
              dataset.measurements.map((measurement) => ({
                x: measurement.axisValue,
                y: measurement.values[parameter] ?? null,
                rowIndex: measurement.index,
              })),
              maxPoints,
            ),
          },
        ],
      };
    },
  );
}

export function unavailableParameterDescriptions(dataset: DrillingDataset): string[] {
  return DEFAULT_CHART_PARAMETERS.filter(
    (parameter) => !dataset.parameters.some((column) => column.canonicalName === parameter && numericValues(dataset, parameter).length > 0),
  ).map((parameter) => `${PARAMETER_DEFINITIONS[parameter].label} is unavailable or has no usable numeric values.`);
}

function axisLabel(dataset: DrillingDataset): string {
  const label = dataset.axis.canonicalName === "depth" ? "Depth" : "Time";
  return dataset.axis.unit ? `${label} (${dataset.axis.unit})` : label;
}

function downsample<T>(points: T[], maxPoints: number): T[] {
  if (points.length <= maxPoints) return points;
  const step = Math.ceil(points.length / maxPoints);
  return points.filter((_, index) => index % step === 0);
}
