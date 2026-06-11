import { describe, expect, it } from "vitest";
import { analyzeRequestSchema } from "@/lib/forms/upload-schema";

describe("analyzeRequestSchema", () => {
  it("accepts KLOGH as a canonical analysis parameter", () => {
    const parsed = analyzeRequestSchema.parse({
      datasetId: "upload-1",
      sourceType: "uploaded",
      axis: { canonicalName: "depth", unit: "m" },
      parameters: [{ canonicalName: "klogh" }],
      measurements: [
        {
          index: 0,
          axisValue: 1000,
          axisKind: "depth",
          values: { klogh: 150 },
          validity: { klogh: "valid" },
        },
      ],
      qualityWarnings: [],
    });

    expect(parsed.parameters).toEqual([{ canonicalName: "klogh" }]);
  });
});
