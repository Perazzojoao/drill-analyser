import { NextResponse } from "next/server";
import { analyzeDrillingDataset } from "@/lib/drilling/anomalies";
import { PARAMETER_DEFINITIONS } from "@/lib/drilling/aliases";
import { calculateDashboardMetrics } from "@/lib/drilling/metrics";
import type { CanonicalParameter, DrillingDataset, RecognizedColumn } from "@/lib/drilling/types";
import { analyzeRequestSchema, type AnalyzeRequest } from "@/lib/forms/upload-schema";
import { createDeterministicTimestamp } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    const payload = analyzeRequestSchema.safeParse(await request.json());

    if (!payload.success) {
      return NextResponse.json(
        { error: { code: "INVALID_DATASET", message: "Analysis request did not match the expected drilling dataset shape.", details: payload.error.flatten() } },
        { status: 400 },
      );
    }

    const dataset = toAnalysisDataset(payload.data);
    const analysis = analyzeDrillingDataset(dataset, payload.data.metricConfigs);
    const metrics = calculateDashboardMetrics(dataset, analysis.alerts.length);

    return NextResponse.json({ datasetId: dataset.id, metrics, findings: analysis.findings, alerts: analysis.alerts });
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_DATASET", message: "Analysis request body must be valid JSON." } },
      { status: 400 },
    );
  }
}

function toAnalysisDataset(payload: AnalyzeRequest): DrillingDataset {
  const axisDefinition = PARAMETER_DEFINITIONS[payload.axis.canonicalName as CanonicalParameter];
  const parameters = payload.parameters.map((parameter): RecognizedColumn => {
    const canonicalName = parameter.canonicalName as CanonicalParameter;
    const definition = PARAMETER_DEFINITIONS[canonicalName];

    return {
      sourceName: definition?.label ?? canonicalName,
      canonicalName,
      role: "parameter",
      unit: parameter.unit ?? definition?.defaultUnit,
      confidence: "exact",
      validValueCount: payload.measurements.filter((measurement) => measurement.validity[canonicalName] === "valid").length,
      invalidValueCount: payload.measurements.filter((measurement) => measurement.validity[canonicalName] !== "valid").length,
    };
  });

  return {
    id: payload.datasetId,
    sourceType: payload.sourceType,
    sourceName: payload.sourceName ?? (payload.sourceType === "mock" ? "Sample drilling dataset" : "Uploaded drilling dataset"),
    loadedAt: createDeterministicTimestamp(),
    rowCount: payload.measurements.length,
    axis: {
      sourceName: axisDefinition?.label ?? payload.axis.canonicalName,
      canonicalName: payload.axis.canonicalName as CanonicalParameter,
      role: "axis",
      unit: payload.axis.unit ?? axisDefinition?.defaultUnit,
      confidence: "exact",
      validValueCount: payload.measurements.length,
      invalidValueCount: 0,
    },
    parameters,
    measurements: payload.measurements,
    qualityWarnings: payload.qualityWarnings.map((warning) => ({ ...warning, parameter: warning.parameter as CanonicalParameter | undefined })),
    isSample: payload.sourceType === "mock",
  };
}
