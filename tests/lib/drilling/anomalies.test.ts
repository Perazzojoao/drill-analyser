import { describe, expect, it } from "vitest";
import { analyzeDrillingDataset } from "@/lib/drilling/anomalies";
import type { DataQualityWarning, DrillingDataset, DrillingMeasurement, RecognizedColumn } from "@/lib/drilling/types";

const parameters: RecognizedColumn[] = [
  { sourceName: "ROP AVG", canonicalName: "rop", role: "parameter", unit: "m/h", confidence: "alias", validValueCount: 8, invalidValueCount: 0 },
  { sourceName: "WOB", canonicalName: "wob", role: "parameter", unit: "klbf", confidence: "exact", validValueCount: 8, invalidValueCount: 0 },
  { sourceName: "PHIF", canonicalName: "phif", role: "parameter", confidence: "exact", validValueCount: 8, invalidValueCount: 0 },
  { sourceName: "VSH", canonicalName: "vsh", role: "parameter", confidence: "exact", validValueCount: 8, invalidValueCount: 0 },
  { sourceName: "SW", canonicalName: "sw", role: "parameter", confidence: "exact", validValueCount: 8, invalidValueCount: 0 },
];

function measurement(index: number, values: Record<string, number | null>): DrillingMeasurement {
  return {
    index,
    axisKind: "depth",
    axisValue: 1000 + index * 5,
    values,
    validity: Object.fromEntries(
      Object.keys(values).map((key) => [key, values[key] === null ? "missing" : "valid"]),
    ),
  };
}

function dataset(measurements: DrillingMeasurement[], qualityWarnings: DataQualityWarning[] = []): DrillingDataset {
  return {
    id: "anomaly-test",
    sourceType: "uploaded",
    sourceName: "anomalies.csv",
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
    parameters,
    measurements,
    qualityWarnings,
  };
}

describe("analyzeDrillingDataset", () => {
  it("flags fixed-range anomalies for drilling and petrophysical parameters", () => {
    const result = analyzeDrillingDataset(
      dataset([
        measurement(0, { rop: 20, wob: 10, phif: 0.2, vsh: 0.3, sw: 0.6 }),
        measurement(1, { rop: -1, wob: 120, phif: 1.2, vsh: -0.1, sw: 1.1 }),
      ]),
    );

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ parameter: "rop", rule: "fixed-range", rowIndex: 1, severity: "critical" }),
        expect.objectContaining({ parameter: "wob", rule: "fixed-range", rowIndex: 1, severity: "warning" }),
        expect.objectContaining({ parameter: "phif", rule: "fixed-range", rowIndex: 1 }),
        expect.objectContaining({ parameter: "vsh", rule: "fixed-range", rowIndex: 1 }),
        expect.objectContaining({ parameter: "sw", rule: "fixed-range", rowIndex: 1 }),
      ]),
    );
  });

  it("detects abrupt spike and drop patterns", () => {
    const result = analyzeDrillingDataset(
      dataset([
        measurement(0, { rop: 20, wob: 10, phif: 0.2, vsh: 0.3, sw: 0.6 }),
        measurement(1, { rop: 22, wob: 10, phif: 0.2, vsh: 0.3, sw: 0.6 }),
        measurement(2, { rop: 85, wob: 10, phif: 0.2, vsh: 0.3, sw: 0.6 }),
        measurement(3, { rop: 18, wob: 10, phif: 0.2, vsh: 0.3, sw: 0.6 }),
      ]),
    );

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ parameter: "rop", rule: "spike-drop", rowIndex: 2, severity: "warning" }),
        expect.objectContaining({ parameter: "rop", rule: "spike-drop", rowIndex: 3, severity: "warning" }),
      ]),
    );
  });

  it("detects missing clusters while ignoring isolated missing values", () => {
    const result = analyzeDrillingDataset(
      dataset([
        measurement(0, { rop: 20, wob: 10, phif: 0.2, vsh: 0.3, sw: 0.6 }),
        measurement(1, { rop: null, wob: 10, phif: 0.2, vsh: 0.3, sw: 0.6 }),
        measurement(2, { rop: null, wob: 10, phif: 0.2, vsh: 0.3, sw: 0.6 }),
        measurement(3, { rop: null, wob: 10, phif: 0.2, vsh: 0.3, sw: 0.6 }),
        measurement(4, { rop: 21, wob: 10, phif: 0.2, vsh: 0.3, sw: 0.6 }),
      ]),
    );

    expect(result.findings).toEqual([
      expect.objectContaining({ parameter: "rop", rule: "missing-cluster", rowIndex: 1, reason: expect.stringContaining("3 consecutive") }),
    ]);
  });

  it("converts sparse data and invalid-value quality warnings into findings and alerts", () => {
    const warnings: DataQualityWarning[] = [
      {
        id: "anomaly-test:sparse-data:rop",
        datasetId: "anomaly-test",
        type: "sparse-data",
        severity: "warning",
        parameter: "rop",
        affectedCount: 5,
        message: "ROP AVG has sparse usable data.",
      },
      {
        id: "anomaly-test:invalid-values:wob",
        datasetId: "anomaly-test",
        type: "invalid-values",
        severity: "warning",
        parameter: "wob",
        affectedCount: 2,
        message: "WOB contains invalid numeric values.",
      },
    ];

    const result = analyzeDrillingDataset(dataset([measurement(0, { rop: 20, wob: 10, phif: 0.2, vsh: 0.3, sw: 0.6 })], warnings));

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rule: "sparse-data", parameter: "rop", severity: "warning" }),
        expect.objectContaining({ rule: "invalid-values", parameter: "wob", severity: "warning" }),
      ]),
    );
    expect(result.alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: expect.stringContaining("Sparse"), dismissed: false }),
        expect.objectContaining({ title: expect.stringContaining("Invalid"), dismissed: false }),
      ]),
    );
  });

  it("returns no findings or alerts for a stable clean dataset", () => {
    const clean = dataset([
      measurement(0, { rop: 20, wob: 10, phif: 0.2, vsh: 0.3, sw: 0.6 }),
      measurement(1, { rop: 21, wob: 11, phif: 0.21, vsh: 0.31, sw: 0.61 }),
      measurement(2, { rop: 22, wob: 12, phif: 0.22, vsh: 0.32, sw: 0.62 }),
    ]);

    expect(analyzeDrillingDataset(clean)).toEqual({ findings: [], alerts: [] });
  });
});
