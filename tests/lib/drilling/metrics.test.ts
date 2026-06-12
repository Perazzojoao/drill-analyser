import { describe, expect, it } from "vitest";
import { buildParameterCharts, calculateDashboardMetrics } from "@/lib/drilling/metrics";
import type { DrillingDataset } from "@/lib/drilling/types";

const dataset: DrillingDataset = {
  id: "test-dataset",
  sourceType: "mock",
  sourceName: "Metric test dataset",
  loadedAt: "2026-06-11T00:00:00.000Z",
  rowCount: 3,
  isSample: true,
  axis: {
    sourceName: "Depth",
    canonicalName: "depth",
    role: "axis",
    unit: "m",
    confidence: "exact",
    validValueCount: 3,
    invalidValueCount: 0,
  },
  parameters: [
    { sourceName: "ROP AVG", canonicalName: "rop", role: "parameter", unit: "m/h", confidence: "alias", validValueCount: 3, invalidValueCount: 0 },
    { sourceName: "WOB", canonicalName: "wob", role: "parameter", unit: "klbf", confidence: "exact", validValueCount: 2, invalidValueCount: 1 },
    { sourceName: "SURF_RPM", canonicalName: "rpm", role: "parameter", unit: "rpm", confidence: "alias", validValueCount: 3, invalidValueCount: 0 },
  ],
  measurements: [
    { index: 0, axisKind: "depth", axisValue: 1000, values: { rop: 10, wob: 12, rpm: 100 }, validity: { rop: "valid", wob: "valid", rpm: "valid" } },
    { index: 1, axisKind: "depth", axisValue: 1010, values: { rop: 20, wob: null, rpm: 110 }, validity: { rop: "valid", wob: "missing", rpm: "valid" } },
    { index: 2, axisKind: "depth", axisValue: 1030, values: { rop: 30, wob: 18, rpm: 120 }, validity: { rop: "valid", wob: "valid", rpm: "valid" } },
  ],
  qualityWarnings: [
    {
      id: "test-dataset:missing-values:wob",
      datasetId: "test-dataset",
      type: "missing-values",
      severity: "warning",
      parameter: "wob",
      affectedCount: 1,
      message: "WOB has missing values.",
    },
  ],
};

describe("calculateDashboardMetrics", () => {
  it("calculates depth coverage, average ROP, average WOB, and configured alert count", () => {
    const metrics = calculateDashboardMetrics(dataset, 1);

    expect(metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "depth-coverage", value: 30, unit: "m" }),
        expect.objectContaining({ id: "avg-rop", value: 20, unit: "m/h" }),
        expect.objectContaining({ id: "avg-wob", value: 15, unit: "klbf" }),
        expect.objectContaining({ id: "configured-alert-count", value: 1, severity: "warning" }),
      ]),
    );
  });
});

describe("buildParameterCharts", () => {
  it("builds chart-ready summaries for available parameters", () => {
    const charts = buildParameterCharts(dataset);

    expect(charts).toHaveLength(3);
    expect(charts[0]).toEqual(
      expect.objectContaining({
        id: "chart-rop",
        axisLabel: "Depth (m)",
        series: [expect.objectContaining({ parameter: "rop", points: expect.arrayContaining([expect.objectContaining({ x: 1000, y: 10 })]) })],
      }),
    );
  });

  it("describes unavailable parameters", () => {
    const charts = buildParameterCharts({ ...dataset, parameters: [], measurements: [] });

    expect(charts).toEqual([
      expect.objectContaining({ id: "chart-unavailable", emptyReason: "No chartable drilling parameters are available." }),
    ]);
  });
});
