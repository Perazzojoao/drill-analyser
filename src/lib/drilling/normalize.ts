import Papa from "papaparse";
import {
  extractUnitHint,
  findParameterDefinition,
  isPercentUnit,
  PARAMETER_DEFINITIONS,
  stripBom,
} from "@/lib/drilling/aliases";
import type {
  CanonicalParameter,
  DataQualityWarning,
  DrillingDataset,
  DrillingMeasurement,
  RecognitionConfidence,
  RecognizedColumn,
  ValueValidity,
} from "@/lib/drilling/types";
import { createSessionTimestamp, createStableId } from "@/lib/utils";
import { MAX_CSV_ROW_COUNT } from "@/lib/forms/upload-schema";

export interface NormalizeCsvOptions {
  sourceName: string;
  sizeBytes?: number;
  loadedAt?: string;
  maxRows?: number;
}

interface RawRow {
  values: Record<string, string>;
  rowIndex: number;
}

export class CsvNormalizationError extends Error {
  constructor(
    message: string,
    public readonly code: "EMPTY_CSV" | "HEADERS_ONLY" | "MISSING_AXIS" | "NO_PARAMETERS" | "ROW_LIMIT_EXCEEDED" | "MALFORMED_CSV",
  ) {
    super(message);
    this.name = "CsvNormalizationError";
  }
}

export function normalizeCsvDataset(csvText: string, options: NormalizeCsvOptions): DrillingDataset {
  const loadedAt = options.loadedAt ?? createSessionTimestamp();
  const datasetId = createStableId("upload", options.sourceName, loadedAt);
  const maxRows = options.maxRows ?? MAX_CSV_ROW_COUNT;
  const parsed = parseCsv(csvText);

  if (parsed.rows.length === 0) {
    throw new CsvNormalizationError("The CSV contains headers but no data rows.", "HEADERS_ONLY");
  }

  if (parsed.rows.length > maxRows) {
    throw new CsvNormalizationError(`The CSV has more than ${maxRows.toLocaleString()} rows.`, "ROW_LIMIT_EXCEEDED");
  }

  const recognized = recognizeColumns(parsed.headers, parsed.rows);
  const axis = recognized.find((column) => column.role === "axis");
  const parameters = recognized.filter((column) => column.role === "parameter");

  if (!axis) {
    throw new CsvNormalizationError("The CSV needs a recognizable depth or time axis.", "MISSING_AXIS");
  }

  if (parameters.length === 0) {
    throw new CsvNormalizationError("The CSV needs at least one usable drilling parameter.", "NO_PARAMETERS");
  }

  const measurements = buildMeasurements(parsed.rows, axis, parameters);
  const qualityWarnings = buildQualityWarnings(datasetId, parsed.headers, recognized, parameters, measurements, parsed.malformedRows);

  return {
    id: datasetId,
    sourceType: "uploaded",
    sourceName: options.sourceName,
    loadedAt,
    rowCount: measurements.length,
    sizeBytes: options.sizeBytes,
    axis: withCounts(axis, measurements),
    parameters: parameters.map((parameter) => withCounts(parameter, measurements)),
    measurements,
    qualityWarnings,
    isSample: false,
  };
}

function parseCsv(csvText: string): { headers: string[]; rows: RawRow[]; malformedRows: number[] } {
  if (!csvText.trim()) {
    throw new CsvNormalizationError("The selected CSV file is empty.", "EMPTY_CSV");
  }

  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => stripBom(header).trim(),
  });

  if (result.errors.some((error) => error.code !== "TooFewFields" && error.code !== "TooManyFields")) {
    throw new CsvNormalizationError("The CSV could not be parsed. Check delimiters and row formatting.", "MALFORMED_CSV");
  }

  const headers = (result.meta.fields ?? []).map((header) => stripBom(header).trim()).filter(Boolean);
  if (headers.length === 0) {
    throw new CsvNormalizationError("The CSV does not contain usable headers.", "EMPTY_CSV");
  }

  const rows = result.data
    .filter((row) => Object.values(row).some((value) => String(value ?? "").trim() !== ""))
    .map((row, index) => ({ values: row, rowIndex: index }));
  const malformedRows = result.errors
    .filter((error) => error.code === "TooFewFields" || error.code === "TooManyFields")
    .map((error) => error.row ?? 0);

  return { headers, rows, malformedRows };
}

function recognizeColumns(headers: string[], rows: RawRow[]): RecognizedColumn[] {
  const usedCanonicals = new Set<CanonicalParameter>();

  return headers.flatMap((header) => {
    const definition = findParameterDefinition(header);
    if (!definition || usedCanonicals.has(definition.canonicalName)) return [];

    usedCanonicals.add(definition.canonicalName);
    const unit = extractUnitHint(header) ?? definition.defaultUnit;
    const confidence: RecognitionConfidence = definition.aliases.some((alias) => alias.toLowerCase() === stripBom(header).trim().toLowerCase())
      ? "exact"
      : unit && !definition.defaultUnit
        ? "unit-hint"
        : "alias";

    const validValueCount = rows.filter((row) => parseCell(row.values[header]).value !== null).length;
    const invalidValueCount = rows.length - validValueCount;

    return [
      {
        sourceName: stripBom(header).trim(),
        canonicalName: definition.canonicalName,
        role: definition.role,
        unit,
        confidence,
        validValueCount,
        invalidValueCount,
      },
    ];
  });
}

function buildMeasurements(rows: RawRow[], axis: RecognizedColumn, parameters: RecognizedColumn[]): DrillingMeasurement[] {
  return rows.flatMap((row) => {
    const axisParse = parseAxis(row.values[axis.sourceName], axis.canonicalName);
    if (axisParse.value === null) return [];

    const values: Record<string, number | null> = {};
    const validity: Record<string, ValueValidity> = {};

    for (const parameter of parameters) {
      const parsed = parseCell(row.values[parameter.sourceName]);
      values[parameter.canonicalName] = parsed.value;
      validity[parameter.canonicalName] = parsed.validity;
    }

    return [
      {
        index: row.rowIndex,
        axisValue: axisParse.value,
        axisKind: axis.canonicalName === "timestamp" ? "time" : "depth",
        values,
        validity,
      },
    ];
  });
}

function parseAxis(value: string | undefined, canonicalName: CanonicalParameter): { value: number | string | null } {
  if (!value?.trim()) return { value: null };
  if (canonicalName === "timestamp") return { value: value.trim() };
  const numeric = Number(value);
  return Number.isFinite(numeric) ? { value: numeric } : { value: null };
}

function parseCell(value: string | undefined): { value: number | null; validity: ValueValidity } {
  if (value === undefined || value.trim() === "") return { value: null, validity: "missing" };
  const numeric = Number(value);
  return Number.isFinite(numeric) ? { value: numeric, validity: "valid" } : { value: null, validity: "invalid" };
}

function withCounts(column: RecognizedColumn, measurements: DrillingMeasurement[]): RecognizedColumn {
  if (column.role === "axis") {
    return { ...column, validValueCount: measurements.length, invalidValueCount: 0 };
  }

  const validValueCount = measurements.filter((measurement) => measurement.validity[column.canonicalName] === "valid").length;
  return {
    ...column,
    validValueCount,
    invalidValueCount: measurements.length - validValueCount,
  };
}

function buildQualityWarnings(
  datasetId: string,
  headers: string[],
  recognized: RecognizedColumn[],
  parameters: RecognizedColumn[],
  measurements: DrillingMeasurement[],
  malformedRows: number[],
): DataQualityWarning[] {
  const warnings: DataQualityWarning[] = [];
  const recognizedHeaders = new Set(recognized.map((column) => column.sourceName));

  for (const header of headers) {
    if (!recognizedHeaders.has(header)) {
      warnings.push({
        id: createStableId(datasetId, "unrecognized-column", header),
        datasetId,
        type: "unrecognized-column",
        severity: "info",
        column: header,
        message: `${header} was not recognized as a supported drilling parameter.`,
      });
    }
  }

  for (const rowIndex of malformedRows) {
    warnings.push({
      id: createStableId(datasetId, "malformed-row", rowIndex),
      datasetId,
      type: "malformed-row",
      severity: "warning",
      rowIndex,
      message: `Row ${rowIndex + 1} has a different number of fields than the header.`,
    });
  }

  for (const parameter of parameters) {
    const invalidCount = measurements.filter((measurement) => measurement.validity[parameter.canonicalName] === "invalid").length;
    const missingCount = measurements.filter((measurement) => measurement.validity[parameter.canonicalName] === "missing").length;
    const validCount = measurements.filter((measurement) => measurement.validity[parameter.canonicalName] === "valid").length;
    const sparseRatio = measurements.length === 0 ? 1 : validCount / measurements.length;

    if (invalidCount > 0) {
      warnings.push({
        id: createStableId(datasetId, "invalid-values", parameter.canonicalName),
        datasetId,
        type: "invalid-values",
        severity: "warning",
        column: parameter.sourceName,
        parameter: parameter.canonicalName,
        affectedCount: invalidCount,
        message: `${parameter.sourceName} contains ${invalidCount} invalid numeric value(s).`,
      });
    }

    if (missingCount > 0) {
      warnings.push({
        id: createStableId(datasetId, "missing-values", parameter.canonicalName),
        datasetId,
        type: "missing-values",
        severity: sparseRatio < 0.5 ? "warning" : "info",
        column: parameter.sourceName,
        parameter: parameter.canonicalName,
        affectedCount: missingCount,
        message: `${parameter.sourceName} contains ${missingCount} missing value(s).`,
      });
    }

    if (sparseRatio < 0.5) {
      warnings.push({
        id: createStableId(datasetId, "sparse-data", parameter.canonicalName),
        datasetId,
        type: "sparse-data",
        severity: "warning",
        column: parameter.sourceName,
        parameter: parameter.canonicalName,
        affectedCount: measurements.length - validCount,
        message: `${parameter.sourceName} has sparse usable data and may not chart reliably.`,
      });
    }

    warnings.push(...petrophysicalRangeWarnings(datasetId, parameter, measurements));
  }

  return warnings;
}

function petrophysicalRangeWarnings(
  datasetId: string,
  parameter: RecognizedColumn,
  measurements: DrillingMeasurement[],
): DataQualityWarning[] {
  const definition = PARAMETER_DEFINITIONS[parameter.canonicalName];
  if (!definition.range || !["phif", "vsh", "sw"].includes(parameter.canonicalName)) return [];

  const max = isPercentUnit(parameter.unit) ? definition.range.percentMax ?? definition.range.max : definition.range.max;
  const outOfRange = measurements.filter((measurement) => {
    const value = measurement.values[parameter.canonicalName];
    return typeof value === "number" && (value < definition.range!.min || value > max);
  });

  if (outOfRange.length === 0) return [];

  return [
    {
      id: createStableId(datasetId, "invalid-values", parameter.canonicalName, "range"),
      datasetId,
      type: "invalid-values",
      severity: "warning",
      column: parameter.sourceName,
      parameter: parameter.canonicalName,
      affectedCount: outOfRange.length,
      message: `${parameter.sourceName} has ${outOfRange.length} value(s) outside the expected ${isPercentUnit(parameter.unit) ? "0-100%" : "0-1 fraction"} range.`,
    },
  ];
}
