import { describe, expect, it } from "vitest";
import { analyzeDrillingDataset } from "@/lib/drilling/anomalies";
import { datasetMetricConfigKey, datasetMetricConfigScope } from "@/lib/drilling/metric-configs";
import type { AlertMetricConfig, CanonicalParameter, DrillingDataset, DrillingMeasurement, RecognizedColumn } from "@/lib/drilling/types";

function parameter(canonicalName: CanonicalParameter, rowCount: number): RecognizedColumn {
  return {
    sourceName: canonicalName,
    canonicalName,
    role: "parameter",
    unit: canonicalName === "rop" ? "m/h" : undefined,
    confidence: "exact",
    validValueCount: rowCount,
    invalidValueCount: 0,
  };
}

function measurement(index: number, values: Record<string, number | null>): DrillingMeasurement {
  return {
    index,
    axisKind: "depth",
    axisValue: 1000 + index * 5,
    values,
    validity: Object.fromEntries(Object.keys(values).map((key) => [key, values[key] === null ? "missing" : "valid"])),
  };
}

function dataset(measurements: DrillingMeasurement[], parameterNames: CanonicalParameter[] = ["rop", "wob"]): DrillingDataset {
  return {
    id: "dynamic-range-test",
    sourceType: "uploaded",
    sourceName: "ranges.csv",
    loadedAt: "2026-06-11T00:00:00.000Z",
    rowCount: measurements.length,
    isSample: false,
    axis: {
      sourceName: "Depth",
      canonicalName: "depth",
      role: "axis",
      unit: "m",
      confidence: "exact",
      validValueCount: measurements.length,
      invalidValueCount: 0,
    },
    parameters: parameterNames.map((name) => parameter(name, measurements.length)),
    measurements,
    qualityWarnings: [
      {
        id: "dynamic-range-test:invalid-values:rop",
        datasetId: "dynamic-range-test",
        type: "invalid-values",
        severity: "warning",
        parameter: "rop",
        affectedCount: 1,
        message: "ROP contains invalid numeric values.",
      },
    ],
  };
}

function metricConfigForDataset(configDataset: DrillingDataset, overrides: Partial<AlertMetricConfig> = {}): AlertMetricConfig {
  return {
    id: "config-rop",
    datasetKey: datasetMetricConfigKey(configDataset),
    datasetId: configDataset.id,
    parameter: "rop",
    min: 10,
    max: 40,
    unit: "m/h",
    createdAt: "2026-06-11T00:00:00.000Z",
    ...overrides,
  };
}

describe("analyzeDrillingDataset", () => {
  it("returns no findings or alerts when no user metric configs exist", () => {
    const result = analyzeDrillingDataset(
      dataset([measurement(0, { rop: -5, wob: 20 }), measurement(1, { rop: 120, wob: 20 })]),
    );

    expect(result).toEqual({ findings: [], alerts: [] });
  });

  it("generates alerts only for values outside user-configured ranges", () => {
    const activeDataset = dataset([
      measurement(0, { rop: 20, wob: 20 }),
      measurement(1, { rop: 5, wob: 20 }),
      measurement(2, { rop: 45, wob: 20 }),
    ]);
    const result = analyzeDrillingDataset(activeDataset, [metricConfigForDataset(activeDataset)]);

    expect(result.findings).toEqual([
      expect.objectContaining({ parameter: "rop", rule: "configured-range", rowIndex: 1, severity: "critical" }),
      expect.objectContaining({ parameter: "rop", rule: "configured-range", rowIndex: 2, severity: "warning" }),
    ]);
    expect(result.alerts).toHaveLength(2);
    expect(result.alerts[0]).toEqual(expect.objectContaining({ title: "ROP outside configured range", dismissed: false }));
  });

  it("reuses configs for a matching uploaded dataset key even when the timestamp-based dataset id changes", () => {
    const activeDataset = { ...dataset([measurement(0, { rop: 50, wob: 100 })]), id: "dynamic-range-test-reloaded" };

    expect(analyzeDrillingDataset(activeDataset, [metricConfigForDataset(activeDataset, { datasetId: "dynamic-range-test" })]).findings).toEqual([
      expect.objectContaining({ parameter: "rop", rule: "configured-range", rowIndex: 0 }),
    ]);
  });

  it("does not apply a new fingerprinted config to the same filename with a different row count", () => {
    const savedDataset = dataset([
      measurement(0, { rop: 20, wob: 20 }),
      measurement(1, { rop: 20, wob: 20 }),
      measurement(2, { rop: 20, wob: 20 }),
    ]);
    const activeDataset = dataset([measurement(0, { rop: 50, wob: 100 })]);

    expect(analyzeDrillingDataset(activeDataset, [metricConfigForDataset(savedDataset)])).toEqual({ findings: [], alerts: [] });
  });

  it("keeps applying a config for the same uploaded file when other recognized parameters change", () => {
    const activeDataset = dataset([measurement(0, { rop: 50, wob: 100, rpm: 120 })], ["rop", "wob", "rpm"]);

    const savedDataset = dataset([measurement(0, { rop: 50, wob: 100 })]);

    expect(analyzeDrillingDataset(activeDataset, [metricConfigForDataset(savedDataset)]).findings).toEqual([
      expect.objectContaining({ parameter: "rop", rule: "configured-range", rowIndex: 0 }),
    ]);
  });

  it("keeps applying legacy strict dataset keys that included a parameter signature", () => {
    const activeDataset = dataset([measurement(0, { rop: 50, wob: 100, rpm: 120 })], ["rop", "wob", "rpm"]);
    const legacyDatasetKey = `${datasetMetricConfigScope(activeDataset)}:rop|wob`;

    expect(analyzeDrillingDataset(activeDataset, [metricConfigForDataset(activeDataset, { datasetKey: legacyDatasetKey })]).findings).toEqual([
      expect.objectContaining({ parameter: "rop", rule: "configured-range", rowIndex: 0 }),
    ]);
  });

  it("ignores configs from other dataset keys and unavailable parameters", () => {
    const activeDataset = dataset([measurement(0, { rop: 50, wob: 100 })]);

    expect(
      analyzeDrillingDataset(activeDataset, [
        metricConfigForDataset(activeDataset, { datasetKey: "uploaded:other.csv:depth:rop|wob" }),
        metricConfigForDataset(activeDataset, { id: "missing-parameter", parameter: "rpm" }),
      ]),
    ).toEqual({ findings: [], alerts: [] });
  });
});
