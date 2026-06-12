export type DatasetSourceType = "mock" | "uploaded";
export type AxisKind = "depth" | "time";
export type ColumnRole = "axis" | "parameter";
export type RecognitionConfidence = "exact" | "alias" | "unit-hint" | "manual";
export type ValueValidity = "valid" | "missing" | "invalid";
export type Severity = "info" | "warning" | "critical";
export type MetricSeverity = "neutral" | "info" | "warning";
export type DashboardSection = "dashboard" | "upload" | "metrics" | "alerts";
export type DashboardTheme = "light" | "dark";

export type CanonicalParameter =
  | "depth"
  | "timestamp"
  | "rop"
  | "wob"
  | "rpm"
  | "phif"
  | "vsh"
  | "sw"
  | "klogh"
  | "torque"
  | "spp"
  | "flowRate";

export interface RecognizedColumn {
  sourceName: string;
  canonicalName: CanonicalParameter;
  role: ColumnRole;
  unit?: string;
  confidence: RecognitionConfidence;
  validValueCount: number;
  invalidValueCount: number;
}

export interface DrillingMeasurement {
  index: number;
  axisValue: number | string;
  axisKind: AxisKind;
  values: Record<string, number | null>;
  validity: Record<string, ValueValidity>;
}

export interface DataQualityWarning {
  id: string;
  datasetId: string;
  type:
    | "missing-values"
    | "invalid-values"
    | "sparse-data"
    | "malformed-row"
    | "unrecognized-column"
    | "missing-axis";
  severity: Severity;
  column?: string;
  parameter?: CanonicalParameter;
  rowIndex?: number;
  startRowIndex?: number;
  endRowIndex?: number;
  affectedCount?: number;
  message: string;
}

export interface DrillingDataset {
  id: string;
  sourceType: DatasetSourceType;
  sourceName: string;
  loadedAt: string;
  rowCount: number;
  sizeBytes?: number;
  axis: RecognizedColumn;
  parameters: RecognizedColumn[];
  measurements: DrillingMeasurement[];
  qualityWarnings: DataQualityWarning[];
  isSample: boolean;
}

export interface DashboardMetric {
  id: string;
  label: string;
  value: string | number;
  unit?: string;
  description?: string;
  source: DatasetSourceType;
  severity?: MetricSeverity;
}

export interface ChartPoint {
  x: number | string;
  y: number | null;
  rowIndex: number;
}

export interface ChartSeries {
  parameter: CanonicalParameter;
  label: string;
  unit?: string;
  points: ChartPoint[];
}

export interface ParameterChart {
  id: string;
  title: string;
  axisLabel: string;
  series: ChartSeries[];
  highlightedFindings: string[];
  emptyReason?: string;
}

export interface AlertMetricConfig {
  id: string;
  datasetKey: string;
  datasetId?: string;
  parameter: CanonicalParameter;
  min: number;
  max: number;
  unit?: string;
  createdAt: string;
}

export interface AnomalyFinding {
  id: string;
  datasetId: string;
  parameter?: CanonicalParameter;
  axisValue?: number | string;
  rowIndex?: number;
  severity: Severity;
  rule: "configured-range" | string;
  reason: string;
  supportingValue?: number | string;
}

export interface AlertNotification {
  id: string;
  datasetId: string;
  title: string;
  message: string;
  severity: Severity;
  rule: AnomalyFinding["rule"];
  parameter?: CanonicalParameter;
  rowIndex?: number;
  dismissed: boolean;
  createdAt: string;
}

export interface NavigationItem {
  id: DashboardSection;
  label: string;
  href: string;
  active: boolean;
  badgeCount?: number;
}

export interface CompactDatasetMeta {
  id: string;
  sourceType: DatasetSourceType;
  sourceName: string;
  loadedAt: string;
  rowCount: number;
  sizeBytes?: number;
  isSample: boolean;
}

export interface DashboardPreferences {
  theme: DashboardTheme;
  activeSection: DashboardSection;
  lastDatasetMeta?: CompactDatasetMeta;
  columnOverrides?: Record<string, string>;
}
