import { describe, expect, it } from "vitest";
import { MAX_ALERT_METRIC_CONFIG_COUNT } from "@/lib/drilling/metric-configs";
import { analyzeRequestSchema } from "@/lib/forms/upload-schema";

function baseRequest() {
  return {
    datasetId: "upload-1",
    sourceType: "uploaded" as const,
    axis: { canonicalName: "depth", unit: "m" },
    parameters: [{ canonicalName: "klogh" }],
    measurements: [
      {
        index: 0,
        axisValue: 1000,
        axisKind: "depth" as const,
        values: { klogh: 150 },
        validity: { klogh: "valid" as const },
      },
    ],
    qualityWarnings: [],
  };
}

describe("analyzeRequestSchema", () => {
  it("accepts KLOGH as a canonical analysis parameter", () => {
    const parsed = analyzeRequestSchema.parse(baseRequest());

    expect(parsed.parameters).toEqual([{ canonicalName: "klogh" }]);
  });

  it("rejects unbounded alert metric config lists", () => {
    const metricConfigs = Array.from({ length: MAX_ALERT_METRIC_CONFIG_COUNT + 1 }, (_, index) => ({
      id: `config-${index}`,
      datasetKey: "uploaded:ranges.csv:depth:klogh",
      parameter: "klogh",
      min: 0,
      max: 100,
      createdAt: "2026-06-11T00:00:00.000Z",
    }));

    expect(() => analyzeRequestSchema.parse({ ...baseRequest(), metricConfigs })).toThrow();
  });
});
