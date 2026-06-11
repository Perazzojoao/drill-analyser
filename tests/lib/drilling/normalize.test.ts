import { describe, expect, it } from "vitest";
import { normalizeCsvDataset } from "@/lib/drilling/normalize";

function normalize(csv: string) {
  return normalizeCsvDataset(csv, {
    sourceName: "upload.csv",
    sizeBytes: new Blob([csv]).size,
    loadedAt: "2026-06-11T00:00:00.000Z",
  });
}

describe("normalizeCsvDataset", () => {
  it("recognizes target ROP schema headers and normalizes measurements", () => {
    const dataset = normalize("Depth,WOB,SURF_RPM,ROP AVG,PHIF,VSH,SW\n1000,12,110,25,0.18,0.3,0.4\n1005,13,112,26,0.19,0.31,0.41");

    expect(dataset.axis).toEqual(expect.objectContaining({ sourceName: "Depth", canonicalName: "depth", role: "axis" }));
    expect(dataset.parameters.map((column) => column.canonicalName)).toEqual(["wob", "rpm", "rop", "phif", "vsh", "sw"]);
    expect(dataset.measurements[0]).toEqual(
      expect.objectContaining({ axisValue: 1000, values: expect.objectContaining({ rop: 25, wob: 12, rpm: 110 }) }),
    );
  });

  it("supports ROP_AVG as a ROP alias", () => {
    const dataset = normalize("Depth,ROP_AVG\n1000,21\n1005,22");

    expect(dataset.parameters).toEqual([expect.objectContaining({ sourceName: "ROP_AVG", canonicalName: "rop" })]);
  });

  it("handles a BOM-prefixed first Depth header", () => {
    const dataset = normalize("\uFEFFDepth,WOB\n1000,11\n1005,12");

    expect(dataset.axis.sourceName).toBe("Depth");
    expect(dataset.axis.validValueCount).toBe(2);
  });

  it("recognizes unit hints from headers", () => {
    const dataset = normalize("Depth (ft),ROP AVG (ft/hr),PHIF (%)\n1000,60,18\n1005,62,19");

    expect(dataset.axis.unit).toBe("ft");
    expect(dataset.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ canonicalName: "rop", unit: "ft/hr" }),
        expect.objectContaining({ canonicalName: "phif", unit: "%" }),
      ]),
    );
  });

  it("throws for missing axis and reports the recovery reason", () => {
    expect(() => normalize("WOB,ROP AVG\n12,25")).toThrow(/recognizable depth or time axis/i);
  });

  it("warns for invalid numeric values without discarding the previous valid fields", () => {
    const dataset = normalize("Depth,WOB,ROP AVG\n1000,abc,25\n1005,12,not-a-number");

    expect(dataset.measurements[0].values.wob).toBeNull();
    expect(dataset.measurements[1].values.rop).toBeNull();
    expect(dataset.qualityWarnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "invalid-values", parameter: "wob", affectedCount: 1 }),
        expect.objectContaining({ type: "invalid-values", parameter: "rop", affectedCount: 1 }),
      ]),
    );
  });

  it("warns when a parameter has sparse usable values", () => {
    const dataset = normalize("Depth,WOB\n1000,\n1005,\n1010,12\n1015,");

    expect(dataset.qualityWarnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "sparse-data", parameter: "wob", severity: "warning" })]),
    );
  });

  it("throws for headers-only CSV", () => {
    expect(() => normalize("Depth,WOB,ROP AVG\n")).toThrow(/no data rows/i);
  });
});
