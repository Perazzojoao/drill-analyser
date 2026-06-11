import type { AlertNotification, AnomalyFinding, DashboardMetric, DrillingDataset } from "@/lib/drilling/types";
import type { AnalyzeRequest } from "@/lib/forms/upload-schema";

interface SampleDatasetResponse {
  dataset: DrillingDataset;
}

export interface AnalyzeDatasetResponse {
  datasetId: string;
  metrics: DashboardMetric[];
  findings: AnomalyFinding[];
  alerts: AlertNotification[];
}

interface ApiErrorResponse {
  error?: {
    code?: string;
    message?: string;
  };
}

export async function fetchSampleDataset(): Promise<DrillingDataset> {
  const response = await fetch("/api/drilling/sample", {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(await apiErrorMessage(response, "Sample drilling data could not be loaded."));
  }

  const payload = (await response.json()) as SampleDatasetResponse;
  return payload.dataset;
}

export async function analyzeDataset(dataset: DrillingDataset): Promise<AnalyzeDatasetResponse> {
  const request: AnalyzeRequest = {
    datasetId: dataset.id,
    sourceType: dataset.sourceType,
    axis: { canonicalName: dataset.axis.canonicalName, unit: dataset.axis.unit },
    parameters: dataset.parameters.map((parameter) => ({ canonicalName: parameter.canonicalName, unit: parameter.unit })),
    measurements: dataset.measurements,
    qualityWarnings: dataset.qualityWarnings,
  };

  const response = await fetch("/api/drilling/analyze", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(await apiErrorMessage(response, "Drilling analysis could not be completed."));
  }

  return (await response.json()) as AnalyzeDatasetResponse;
}

async function apiErrorMessage(response: Response, fallback: string): Promise<string> {
  let payload: ApiErrorResponse = {};
  try {
    payload = (await response.json()) as ApiErrorResponse;
  } catch {
    payload = {};
  }

  return payload.error?.message ?? fallback;
}
