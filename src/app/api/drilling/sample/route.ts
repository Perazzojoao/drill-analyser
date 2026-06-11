import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { PARAMETER_DEFINITIONS } from "@/lib/drilling/aliases";
import type { CanonicalParameter, DrillingDataset, DrillingMeasurement, RecognizedColumn } from "@/lib/drilling/types";
import { createDeterministicTimestamp } from "@/lib/utils";

export const dynamic = "force-static";

const SAMPLE_COLUMNS: Array<{ sourceName: string; canonicalName: CanonicalParameter; unit?: string; confidence: "exact" | "alias" }> = [
  { sourceName: "ROP AVG", canonicalName: "rop", unit: "m/h", confidence: "alias" },
  { sourceName: "WOB", canonicalName: "wob", unit: "klbf", confidence: "exact" },
  { sourceName: "SURF_RPM", canonicalName: "rpm", unit: "rpm", confidence: "alias" },
  { sourceName: "PHIF", canonicalName: "phif", confidence: "exact" },
  { sourceName: "VSH", canonicalName: "vsh", confidence: "exact" },
  { sourceName: "SW", canonicalName: "sw", confidence: "exact" },
];

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "public", "data", "sample-drilling.csv");
    const csv = await readFile(filePath, "utf8");
    const dataset = parseSampleCsv(csv);

    return NextResponse.json({ dataset });
  } catch {
    return NextResponse.json(
      { error: { code: "SAMPLE_DATA_UNAVAILABLE", message: "Bundled sample drilling data could not be loaded." } },
      { status: 500 },
    );
  }
}

function parseSampleCsv(csv: string): DrillingDataset {
  const [headerLine, ...rowLines] = csv.trim().split(/\r?\n/);
  const headers = headerLine.split(",");
  const rows = rowLines.map((line) => line.split(","));
  const measurements: DrillingMeasurement[] = rows.map((row, index) => {
    const rowByHeader = Object.fromEntries(headers.map((header, columnIndex) => [header, row[columnIndex]]));
    const values = Object.fromEntries(
      SAMPLE_COLUMNS.map(({ sourceName, canonicalName }) => [canonicalName, parseNumber(rowByHeader[sourceName])]),
    );

    return {
      index,
      axisKind: "depth",
      axisValue: parseNumber(rowByHeader.Depth) ?? index,
      values,
      validity: Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value === null ? "invalid" : "valid"])),
    };
  });

  const parameters: RecognizedColumn[] = SAMPLE_COLUMNS.map((column) => ({
    sourceName: column.sourceName,
    canonicalName: column.canonicalName,
    role: "parameter",
    unit: column.unit ?? PARAMETER_DEFINITIONS[column.canonicalName].defaultUnit,
    confidence: column.confidence,
    validValueCount: measurements.filter((measurement) => typeof measurement.values[column.canonicalName] === "number").length,
    invalidValueCount: measurements.filter((measurement) => measurement.values[column.canonicalName] === null).length,
  }));

  return {
    id: "sample-drilling-001",
    sourceType: "mock",
    sourceName: "Sample drilling dataset",
    loadedAt: createDeterministicTimestamp(),
    rowCount: measurements.length,
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
    qualityWarnings: [],
    isSample: true,
  };
}

function parseNumber(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
