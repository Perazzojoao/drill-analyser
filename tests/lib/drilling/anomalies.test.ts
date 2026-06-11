import { describe, expect, it } from "vitest";
import { analyzeDrillingDataset } from "@/lib/drilling/anomalies";
import type { CanonicalParameter, DataQualityWarning, DrillingDataset, DrillingMeasurement, RecognizedColumn } from "@/lib/drilling/types";

const parameterMeta: Record<CanonicalParameter, { sourceName: string; unit?: string }> = {
  depth: { sourceName: "Depth", unit: "m" },
  timestamp: { sourceName: "Time" },
  rop: { sourceName: "ROP AVG", unit: "m/h" },
  wob: { sourceName: "WOB", unit: "klbf" },
  rpm: { sourceName: "SURF_RPM", unit: "rpm" },
  phif: { sourceName: "PHIF" },
  vsh: { sourceName: "VSH" },
  sw: { sourceName: "SW" },
  klogh: { sourceName: "KLOGH" },
  torque: { sourceName: "Torque" },
  spp: { sourceName: "SPP", unit: "psi" },
  flowRate: { sourceName: "Flow Rate", unit: "gpm" },
};

const defaultValues = {
  rop: 25,
  wob: 20,
  rpm: 120,
  torque: 30,
  spp: 3000,
  flowRate: 500,
  phif: 0.2,
  vsh: 0.3,
  sw: 0.6,
};

function parameter(canonicalName: CanonicalParameter, rowCount: number): RecognizedColumn {
  const meta = parameterMeta[canonicalName];
  return {
    sourceName: meta.sourceName,
    canonicalName,
    role: "parameter",
    unit: meta.unit,
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
    validity: Object.fromEntries(
      Object.keys(values).map((key) => [key, values[key] === null ? "missing" : "valid"]),
    ),
  };
}

function rows(overrides: Array<Partial<typeof defaultValues>>): DrillingMeasurement[] {
  return overrides.map((override, index) => measurement(index, { ...defaultValues, ...override }));
}

function dataset(
  measurements: DrillingMeasurement[],
  qualityWarnings: DataQualityWarning[] = [],
  parameterNames: CanonicalParameter[] = ["rop", "wob", "rpm", "torque", "spp", "flowRate", "phif", "vsh", "sw"],
): DrillingDataset {
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
    parameters: parameterNames.map((name) => parameter(name, measurements.length)),
    measurements,
    qualityWarnings,
  };
}

function rules(result: ReturnType<typeof analyzeDrillingDataset>): string[] {
  return result.findings.map((finding) => finding.rule);
}

describe("analyzeDrillingDataset", () => {
  it("flags fixed-range anomalies for drilling and petrophysical parameters", () => {
    const result = analyzeDrillingDataset(
      dataset(rows([{ rop: 20 }, { rop: -1, wob: 120, phif: 1.2, vsh: -0.1, sw: 1.1 }])),
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

  it("detects possible kick/influx proxy without duplicate generic spikes", () => {
    const result = analyzeDrillingDataset(
      dataset(rows([
        { rop: 20, spp: 3000, flowRate: 500 },
        { rop: 24, spp: 2600, flowRate: 505 },
        { rop: 25, spp: 2580, flowRate: 505 },
      ])),
    );

    expect(result.findings).toEqual([
      expect.objectContaining({ rule: "possible-kick-influx", parameter: "rop", rowIndex: 2, severity: "warning" }),
    ]);
    expect(result.findings[0].reason).toEqual(expect.stringContaining("Possible"));
    expect(result.findings[0].reason).toEqual(expect.stringContaining("Confirm with unsupported signals"));
    expect(rules(result)).not.toContain("spike-drop");
  });

  it("detects possible washout proxy when SPP drops and flow is stable without requiring ROP increase", () => {
    const result = analyzeDrillingDataset(
      dataset(rows([
        { rop: 20, spp: 3000, flowRate: 500 },
        { rop: 20, spp: 2600, flowRate: 500 },
        { rop: 20, spp: 2590, flowRate: 500 },
      ])),
    );

    expect(result.findings).toEqual([
      expect.objectContaining({ rule: "possible-washout", parameter: "spp", rowIndex: 2, severity: "warning" }),
    ]);
    expect(result.findings[0].reason).toEqual(expect.stringContaining("Possible washout proxy"));
  });

  it("does not flag kick or washout when flow falls with SPP", () => {
    const result = analyzeDrillingDataset(
      dataset(rows([
        { rop: 20, spp: 3000, flowRate: 500 },
        { rop: 26, spp: 2600, flowRate: 430 },
        { rop: 25, spp: 2580, flowRate: 420 },
      ])),
    );

    expect(rules(result)).not.toContain("possible-kick-influx");
    expect(rules(result)).not.toContain("possible-washout");
  });

  it("does not flag one-sample hydraulic blips as kick or washout proxies", () => {
    const result = analyzeDrillingDataset(
      dataset(rows([
        { rop: 20, spp: 3000, flowRate: 500 },
        { rop: 26, spp: 2600, flowRate: 505 },
        { rop: 21, spp: 3000, flowRate: 500 },
      ])),
    );

    expect(rules(result)).not.toContain("possible-kick-influx");
    expect(rules(result)).not.toContain("possible-washout");
  });

  it("detects possible stuck-pipe proxy only when collapsed ROP is sustained with torque rise and active RPM/WOB", () => {
    const result = analyzeDrillingDataset(
      dataset(rows([
        { rop: 30, torque: 30, rpm: 120, wob: 25 },
        { rop: 0.8, torque: 32, rpm: 120, wob: 25 },
        { rop: 0.6, torque: 38, rpm: 120, wob: 25 },
      ])),
    );

    expect(result.findings).toEqual([
      expect.objectContaining({ rule: "possible-stuck-pipe", parameter: "rop", rowIndex: 2, severity: "warning" }),
    ]);
    expect(result.findings[0].reason).toEqual(expect.stringContaining("proxy"));
    expect(result.findings[0].reason).toEqual(expect.stringContaining("hookload"));
  });

  it("does not flag possible stuck pipe for a one-row ROP dip", () => {
    const result = analyzeDrillingDataset(
      dataset(rows([
        { rop: 30, torque: 30, rpm: 120, wob: 25 },
        { rop: 0.8, torque: 38, rpm: 120, wob: 25 },
        { rop: 28, torque: 32, rpm: 120, wob: 25 },
      ])),
    );

    expect(rules(result)).not.toContain("possible-stuck-pipe");
  });

  it("detects bit-balling proxy with optional VSH context", () => {
    const result = analyzeDrillingDataset(
      dataset(rows([
        { rop: 40, wob: 20, rpm: 120, torque: 30, vsh: 0.5 },
        { rop: 28, wob: 21, rpm: 120, torque: 34, vsh: 0.55 },
        { rop: 27, wob: 21, rpm: 120, torque: 34, vsh: 0.55 },
      ])),
    );

    expect(result.findings).toEqual([
      expect.objectContaining({ rule: "bit-balling-proxy", parameter: "rop", rowIndex: 1, severity: "info" }),
    ]);
    expect(result.findings[0].reason).toEqual(expect.stringContaining("Bit-balling proxy"));
    expect(result.findings[0].reason).toEqual(expect.stringContaining("High VSH"));
    expect(result.findings[0].reason).toEqual(expect.stringContaining("not diagnostic"));
  });

  it("avoids bit-balling false positives when WOB/RPM effort is not maintained", () => {
    const result = analyzeDrillingDataset(
      dataset(rows([
        { rop: 40, wob: 20, rpm: 120, torque: 30 },
        { rop: 25, wob: 10, rpm: 60, torque: 34 },
        { rop: 25, wob: 10, rpm: 60, torque: 34 },
      ])),
    );

    expect(rules(result)).not.toContain("bit-balling-proxy");
  });

  it("restricts generic abrupt spike/drop findings to operational parameters", () => {
    const result = analyzeDrillingDataset(
      dataset(rows([
        { rop: 20, phif: 0.1, vsh: 0.1 },
        { rop: 22, phif: 0.2, vsh: 0.2 },
        { rop: 90, phif: 0.9, vsh: 0.9 },
        { rop: 18, phif: 0.2, vsh: 0.2 },
      ])),
    );

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ parameter: "rop", rule: "spike-drop", rowIndex: 2, severity: "warning" }),
        expect.objectContaining({ parameter: "rop", rule: "spike-drop", rowIndex: 3, severity: "warning" }),
      ]),
    );
    expect(result.findings).not.toEqual(expect.arrayContaining([expect.objectContaining({ parameter: "phif", rule: "spike-drop" })]));
    expect(result.findings).not.toEqual(expect.arrayContaining([expect.objectContaining({ parameter: "vsh", rule: "spike-drop" })]));
  });

  it("detects missing clusters while ignoring isolated missing values", () => {
    const result = analyzeDrillingDataset(
      dataset([
        measurement(0, { ...defaultValues, rop: 20 }),
        measurement(1, { ...defaultValues, rop: null }),
        measurement(2, { ...defaultValues, rop: null }),
        measurement(3, { ...defaultValues, rop: null }),
        measurement(4, { ...defaultValues, rop: 21 }),
      ]),
    );

    expect(result.findings).toEqual([
      expect.objectContaining({ parameter: "rop", rule: "missing-cluster", rowIndex: 1, reason: expect.stringContaining("3 consecutive") }),
    ]);
  });

  it("does not emit missing optional advanced signal alerts for a clean target-schema dataset", () => {
    const targetSchema = dataset(
      rows([
        { rop: 20, wob: 10, rpm: 100, phif: 0.2, vsh: 0.3, sw: 0.6 },
        { rop: 21, wob: 11, rpm: 100, phif: 0.21, vsh: 0.31, sw: 0.61 },
        { rop: 22, wob: 12, rpm: 100, phif: 0.22, vsh: 0.32, sw: 0.62 },
      ]),
      [],
      ["rop", "wob", "rpm", "phif", "vsh", "sw"],
    );

    expect(analyzeDrillingDataset(targetSchema)).toEqual({ findings: [], alerts: [] });
  });

  it("emits one limited-signals info finding only for partially present advanced signal groups", () => {
    const result = analyzeDrillingDataset(
      dataset(
        [measurement(0, { rop: 20, wob: 10, rpm: 100, spp: 3000, phif: 0.2, vsh: 0.3, sw: 0.6 })],
        [],
        ["rop", "wob", "rpm", "spp", "phif", "vsh", "sw"],
      ),
    );

    expect(result.findings).toEqual([
      expect.objectContaining({ rule: "limited-horizontal-signals", severity: "info" }),
    ]);
    expect(result.findings[0]).not.toHaveProperty("parameter");
    expect(result.findings[0].reason).toEqual(expect.stringContaining("partial hydraulics"));
    expect(result.findings[0].reason).toEqual(expect.stringContaining("inclination/azimuth"));
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

    const result = analyzeDrillingDataset(dataset(rows([{ rop: 20 }]), warnings));

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

  it("returns no findings or alerts for a stable clean dataset with full supported signals", () => {
    const clean = dataset(rows([
      { rop: 20, wob: 10, rpm: 100, torque: 25, spp: 3000, flowRate: 500, phif: 0.2, vsh: 0.3, sw: 0.6 },
      { rop: 21, wob: 11, rpm: 100, torque: 25, spp: 3000, flowRate: 500, phif: 0.21, vsh: 0.31, sw: 0.61 },
      { rop: 22, wob: 12, rpm: 100, torque: 25, spp: 3000, flowRate: 500, phif: 0.22, vsh: 0.32, sw: 0.62 },
    ]));

    expect(analyzeDrillingDataset(clean)).toEqual({ findings: [], alerts: [] });
  });
});
