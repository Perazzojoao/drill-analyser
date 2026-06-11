import { isPercentUnit, PARAMETER_DEFINITIONS } from "@/lib/drilling/aliases";
import type {
  AlertNotification,
  AnomalyFinding,
  CanonicalParameter,
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
const OPERATIONAL_SPIKE_DROP_PARAMETERS = new Set<CanonicalParameter>(["rop", "wob", "rpm", "torque", "spp", "flowRate"]);
const DOMAIN_RULE_PARAMETERS = new Set<CanonicalParameter>(["rop", "wob", "rpm", "torque", "spp", "flowRate"]);

const SPP_DROP_RATIO = 0.1;
const FLOW_STABLE_TOLERANCE_RATIO = 0.03;
const ROP_INCREASE_RATIO = 0.15;
const ROP_DECLINE_RATIO = 0.25;
const ROP_COLLAPSE_RATIO = 0.2;
const ROP_NEAR_ZERO = 1;
const TORQUE_RISE_RATIO = 0.15;
const BIT_BALLING_TORQUE_RESPONSE_RATIO = 0.1;
const HYDRAULIC_SUSTAINED_DROP_RATIO = 0.06;
const ACTIVE_EFFORT_MIN_RATIO = 0.05;
const HIGH_VSH_CONTEXT = 0.45;

type NumericPoint = { measurement: DrillingMeasurement; value: number };

export function analyzeDrillingDataset(dataset: DrillingDataset): DrillingAnalysisResult {
  const domainFindings = domainProxyFindings(dataset);
  const suppressedGenericChanges = genericChangeSuppressionKeys(domainFindings);
  const findings = [
    ...fixedRangeFindings(dataset),
    ...domainFindings,
    ...spikeDropFindings(dataset, suppressedGenericChanges),
    ...missingClusterFindings(dataset),
    ...qualityWarningFindings(dataset),
    ...limitedSignalFindings(dataset),
  ];
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

function domainProxyFindings(dataset: DrillingDataset): AnomalyFinding[] {
  return [
    ...possibleKickOrWashoutFindings(dataset),
    ...possibleStuckPipeFindings(dataset),
    ...bitBallingProxyFindings(dataset),
  ];
}

function possibleKickOrWashoutFindings(dataset: DrillingDataset): AnomalyFinding[] {
  if (!hasParameters(dataset, ["spp", "flowRate"])) return [];

  return dataset.measurements.slice(2).flatMap((measurement, offset) => {
    const start = dataset.measurements[offset];
    const previous = dataset.measurements[offset + 1];
    const startSpp = valueOf(start, "spp");
    const previousSpp = valueOf(previous, "spp");
    const currentSpp = valueOf(measurement, "spp");
    const startFlow = valueOf(start, "flowRate");
    const previousFlow = valueOf(previous, "flowRate");
    const currentFlow = valueOf(measurement, "flowRate");

    if (
      !isPositive(startSpp) ||
      !isFiniteNumber(previousSpp) ||
      !isFiniteNumber(currentSpp) ||
      !isPositive(startFlow) ||
      !isFiniteNumber(previousFlow) ||
      !isFiniteNumber(currentFlow)
    ) {
      return [];
    }

    const sustainedSppDrop =
      ratioDrop(startSpp, previousSpp) >= HYDRAULIC_SUSTAINED_DROP_RATIO &&
      ratioDrop(startSpp, currentSpp) >= SPP_DROP_RATIO &&
      currentSpp <= previousSpp;
    const flowStableOrIncreasing = isStableOrIncreasing(previousFlow, startFlow) && isStableOrIncreasing(currentFlow, previousFlow);
    if (!sustainedSppDrop || !flowStableOrIncreasing) return [];

    const startRop = valueOf(start, "rop");
    const currentRop = valueOf(measurement, "rop");
    const ropIncreased = isPositive(startRop) && isFiniteNumber(currentRop) && currentRop >= startRop * (1 + ROP_INCREASE_RATIO);

    if (ropIncreased) {
      return [
        domainFinding(dataset, measurement, "rop", "possible-kick-influx", "warning", `Possible kick/influx proxy: standpipe pressure showed a sustained multi-row drop while flow stayed stable/increased and ROP increased. Confirm with unsupported signals such as pit volume, flow-out, mud weight, gas, and ECD before diagnosis.`),
      ];
    }

    return [
      domainFinding(dataset, measurement, "spp", "possible-washout", "warning", `Possible washout proxy: standpipe pressure showed a sustained multi-row drop while flow stayed stable/increased. This does not require ROP change; confirm with unsupported signals such as pump strokes, bit/nozzle condition, return flow, and downhole pressure before diagnosis.`),
    ];
  });
}

function possibleStuckPipeFindings(dataset: DrillingDataset): AnomalyFinding[] {
  if (!hasParameters(dataset, ["rop", "torque", "rpm", "wob"])) return [];

  return dataset.measurements.slice(2).flatMap((measurement, offset) => {
    const baseline = dataset.measurements[offset];
    const previous = dataset.measurements[offset + 1];
    const baselineRop = valueOf(baseline, "rop");
    const previousRop = valueOf(previous, "rop");
    const currentRop = valueOf(measurement, "rop");
    const baselineTorque = valueOf(baseline, "torque");
    const currentTorque = valueOf(measurement, "torque");
    const currentRpm = valueOf(measurement, "rpm");
    const currentWob = valueOf(measurement, "wob");

    if (
      !isFiniteNumber(baselineRop) ||
      !isFiniteNumber(previousRop) ||
      !isFiniteNumber(currentRop) ||
      !isFiniteNumber(baselineTorque) ||
      !isFiniteNumber(currentTorque) ||
      !isFiniteNumber(currentRpm) ||
      !isFiniteNumber(currentWob)
    ) {
      return [];
    }

    const sustainedCollapse = isCollapsedRop(previousRop, baselineRop) && isCollapsedRop(currentRop, baselineRop);
    const torqueRose = currentTorque >= baselineTorque * (1 + TORQUE_RISE_RATIO);
    const activeDrilling = hasActiveEffort(currentRpm, valueOf(baseline, "rpm")) && hasActiveEffort(currentWob, valueOf(baseline, "wob"));
    if (!sustainedCollapse || !torqueRose || !activeDrilling) return [];

    return [
      domainFinding(dataset, measurement, "rop", "possible-stuck-pipe", "warning", `Possible stuck-pipe proxy: ROP stayed near zero/collapsed while torque rose with active RPM and WOB. Confirm with unsupported signals such as hookload, overpull, drag, standpipe pressure trend, and block movement before diagnosis.`),
    ];
  });
}

function bitBallingProxyFindings(dataset: DrillingDataset): AnomalyFinding[] {
  if (!hasParameters(dataset, ["rop", "wob", "rpm", "torque"])) return [];

  return dataset.measurements.slice(1).flatMap((measurement, offset) => {
    const previous = dataset.measurements[offset];
    const previousRop = valueOf(previous, "rop");
    const currentRop = valueOf(measurement, "rop");
    const previousWob = valueOf(previous, "wob");
    const currentWob = valueOf(measurement, "wob");
    const previousRpm = valueOf(previous, "rpm");
    const currentRpm = valueOf(measurement, "rpm");
    const previousTorque = valueOf(previous, "torque");
    const currentTorque = valueOf(measurement, "torque");

    if (
      !isFiniteNumber(previousRop) ||
      !isFiniteNumber(currentRop) ||
      !isFiniteNumber(previousWob) ||
      !isFiniteNumber(currentWob) ||
      !isFiniteNumber(previousRpm) ||
      !isFiniteNumber(currentRpm) ||
      !isFiniteNumber(previousTorque) ||
      !isFiniteNumber(currentTorque)
    ) {
      return [];
    }

    const ropDeclined = previousRop > ROP_NEAR_ZERO && ratioDrop(previousRop, currentRop) >= ROP_DECLINE_RATIO;
    const effortMaintained = currentWob >= previousWob * 0.95 && currentRpm >= previousRpm * 0.95;
    const torqueResponded = currentTorque >= previousTorque * (1 + BIT_BALLING_TORQUE_RESPONSE_RATIO);
    const notStuckPipeLike = currentRop > ROP_NEAR_ZERO;
    if (!ropDeclined || !effortMaintained || !torqueResponded || !notStuckPipeLike) return [];

    const vsh = valueOf(measurement, "vsh");
    const shaleContext = isFiniteNumber(vsh) && vsh >= HIGH_VSH_CONTEXT ? " High VSH provides optional shale context, but is not diagnostic." : "";

    return [
      domainFinding(dataset, measurement, "rop", "bit-balling-proxy", "info", `Bit-balling proxy: ROP declined despite maintained WOB/RPM effort and a torque response.${shaleContext} Confirm with unsupported signals such as cuttings character, bit condition, MSE, differential pressure, and mud properties before diagnosis.`),
    ];
  });
}

function domainFinding(
  dataset: DrillingDataset,
  measurement: DrillingMeasurement,
  parameter: CanonicalParameter,
  rule: string,
  severity: AnomalyFinding["severity"],
  reason: string,
): AnomalyFinding {
  return {
    id: createStableId(dataset.id, rule, parameter, measurement.index),
    datasetId: dataset.id,
    parameter,
    axisValue: measurement.axisValue,
    rowIndex: measurement.index,
    severity,
    rule,
    reason,
    supportingValue: measurement.values[parameter] ?? undefined,
  };
}

function spikeDropFindings(dataset: DrillingDataset, suppressedChanges: Set<string>): AnomalyFinding[] {
  return dataset.parameters.flatMap((parameter) => {
    if (!OPERATIONAL_SPIKE_DROP_PARAMETERS.has(parameter.canonicalName)) return [];

    const values = numericPoints(dataset, parameter.canonicalName);
    if (values.length < 3) return [];

    return values.slice(1).flatMap((point, index) => {
      if (suppressedChanges.has(changeKey(parameter.canonicalName, point.measurement.index))) return [];

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

function limitedSignalFindings(dataset: DrillingDataset): AnomalyFinding[] {
  if (dataset.measurements.length === 0) return [];

  const hasSpp = hasParameter(dataset, "spp");
  const hasFlowRate = hasParameter(dataset, "flowRate");
  const hasTorque = hasParameter(dataset, "torque");
  const hasAnyHydraulicSignal = hasSpp || hasFlowRate;
  const hasPartialHydraulicSignal = hasAnyHydraulicSignal && !(hasSpp && hasFlowRate);
  const hasPartialTorqueMechanics = hasTorque && !hasParameters(dataset, ["rop", "wob", "rpm", "torque"]);

  const missingGroups = [
    hasPartialHydraulicSignal ? "partial hydraulics (both SPP and flow rate are needed)" : undefined,
    hasPartialTorqueMechanics ? "partial mechanics (ROP, WOB, RPM, and torque are needed together)" : undefined,
  ].filter((group): group is string => Boolean(group));

  if (missingGroups.length === 0) return [];

  return [
    {
      id: createStableId(dataset.id, "limited-horizontal-signals", missingGroups.join(",")),
      datasetId: dataset.id,
      severity: "info",
      rule: "limited-horizontal-signals",
      reason: `Limited horizontal/drilling dysfunction screening: missing ${missingGroups.join(" and ")}. Findings are proxies only; confirm with unsupported signals such as inclination/azimuth, hookload, pit volume, mud properties, flow-out, and downhole pressure before diagnosis.`,
      supportingValue: missingGroups.length,
    },
  ];
}

function numericPoints(dataset: DrillingDataset, parameter: CanonicalParameter): NumericPoint[] {
  return dataset.measurements
    .map((measurement) => ({ measurement, value: measurement.values[parameter] }))
    .filter((point): point is NumericPoint => isFiniteNumber(point.value));
}

function hasParameters(dataset: DrillingDataset, parameters: CanonicalParameter[]): boolean {
  return parameters.every((parameter) => hasParameter(dataset, parameter));
}

function hasParameter(dataset: DrillingDataset, parameter: CanonicalParameter): boolean {
  return dataset.parameters.some((candidate) => candidate.canonicalName === parameter);
}

function valueOf(measurement: DrillingMeasurement, parameter: CanonicalParameter): number | undefined {
  const value = measurement.values[parameter];
  return isFiniteNumber(value) ? value : undefined;
}

function ratioDrop(previous: number, current: number): number {
  return previous <= 0 ? 0 : (previous - current) / previous;
}

function isStableOrIncreasing(current: number, previous: number): boolean {
  return current >= previous * (1 - FLOW_STABLE_TOLERANCE_RATIO);
}

function hasActiveEffort(current: number, baseline?: number): boolean {
  if (current <= 0) return false;
  if (!isPositive(baseline)) return true;
  return current >= baseline * ACTIVE_EFFORT_MIN_RATIO;
}

function isCollapsedRop(rop: number, baselineRop: number): boolean {
  return rop <= ROP_NEAR_ZERO || (baselineRop > ROP_NEAR_ZERO && rop <= baselineRop * ROP_COLLAPSE_RATIO);
}

function isPositive(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function genericChangeSuppressionKeys(domainFindings: AnomalyFinding[]): Set<string> {
  const keys = new Set<string>();

  for (const finding of domainFindings) {
    if (finding.rowIndex === undefined) continue;

    if (finding.rule === "possible-kick-influx") {
      keys.add(changeKey("rop", finding.rowIndex));
      keys.add(changeKey("spp", finding.rowIndex));
      keys.add(changeKey("flowRate", finding.rowIndex));
      continue;
    }

    if (finding.rule === "possible-stuck-pipe") {
      for (const parameter of DOMAIN_RULE_PARAMETERS) {
        keys.add(changeKey(parameter, finding.rowIndex));
        keys.add(changeKey(parameter, finding.rowIndex - 1));
      }
      continue;
    }

    if (["possible-washout", "bit-balling-proxy"].includes(finding.rule)) {
      for (const parameter of DOMAIN_RULE_PARAMETERS) keys.add(changeKey(parameter, finding.rowIndex));
    }
  }

  return keys;
}

function changeKey(parameter: CanonicalParameter, rowIndex: number): string {
  return `${parameter}:${rowIndex}`;
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
    case "possible-kick-influx":
      return "Possible kick/influx proxy";
    case "possible-washout":
      return "Possible washout proxy";
    case "possible-stuck-pipe":
      return "Possible stuck-pipe proxy";
    case "bit-balling-proxy":
      return "Bit-balling proxy";
    case "limited-horizontal-signals":
      return "Limited signal screening";
    default:
      return `${parameterLabel} alert`;
  }
}

function alertMessage(finding: AnomalyFinding, dataset: DrillingDataset): string {
  const axisLabel = dataset.axis.canonicalName === "depth" ? "depth" : "time";
  const position = finding.axisValue !== undefined ? ` near ${axisLabel} ${finding.axisValue}${dataset.axis.unit ? ` ${dataset.axis.unit}` : ""}` : "";
  return `${finding.reason}${position}.`;
}
