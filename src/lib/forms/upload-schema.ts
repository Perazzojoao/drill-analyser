import { z } from "zod";

import { MAX_ALERT_METRIC_CONFIG_COUNT } from "@/lib/drilling/metric-configs";

export const MAX_CSV_SIZE_BYTES = 25 * 1024 * 1024;
export const MAX_CSV_ROW_COUNT = 250_000;

export const uploadRecoveryMessages = {
  invalidType: "Choose a .csv file exported from a drilling or ROP data source.",
  empty: "The selected CSV is empty. Export rows with a header and at least one data row.",
  tooLarge: "This file is larger than the 25 MB MVP target. Split the CSV or export a smaller interval.",
  parseFailed: "The previous valid dataset is still displayed. Fix the CSV and try again.",
} as const;

export const csvFileSchema = z
  .custom<File>((value) => typeof File !== "undefined" && value instanceof File, {
    message: "Choose a CSV file to upload.",
  })
  .refine((file) => file.size > 0, uploadRecoveryMessages.empty)
  .refine(
    (file) => file.name.toLowerCase().endsWith(".csv") || ["text/csv", "application/vnd.ms-excel", ""].includes(file.type),
    uploadRecoveryMessages.invalidType,
  )
  .refine((file) => file.size <= MAX_CSV_SIZE_BYTES, uploadRecoveryMessages.tooLarge);

export const uploadFormSchema = z.object({
  file: csvFileSchema,
});

const canonicalParameterSchema = z.enum(["depth", "timestamp", "rop", "wob", "rpm", "phif", "vsh", "sw", "klogh", "torque", "spp", "flowRate"]);

export const recognizedColumnSchema = z.object({
  sourceName: z.string(),
  canonicalName: canonicalParameterSchema,
  role: z.enum(["axis", "parameter"]),
  unit: z.string().optional(),
  confidence: z.enum(["exact", "alias", "unit-hint", "manual"]),
  validValueCount: z.number().int().nonnegative(),
  invalidValueCount: z.number().int().nonnegative(),
});

export const drillingMeasurementSchema = z.object({
  index: z.number().int().nonnegative(),
  axisValue: z.union([z.number(), z.string()]),
  axisKind: z.enum(["depth", "time"]),
  values: z.record(z.string(), z.number().nullable()),
  validity: z.record(z.string(), z.enum(["valid", "missing", "invalid"])),
});

export const dataQualityWarningSchema = z.object({
  id: z.string(),
  datasetId: z.string(),
  type: z.enum([
    "missing-values",
    "invalid-values",
    "sparse-data",
    "malformed-row",
    "unrecognized-column",
    "missing-axis",
  ]),
  severity: z.enum(["info", "warning", "critical"]),
  column: z.string().optional(),
  parameter: z.string().optional(),
  rowIndex: z.number().int().nonnegative().optional(),
  startRowIndex: z.number().int().nonnegative().optional(),
  endRowIndex: z.number().int().nonnegative().optional(),
  affectedCount: z.number().int().nonnegative().optional(),
  message: z.string(),
});

export const alertMetricConfigSchema = z.object({
  id: z.string().min(1),
  datasetKey: z.string().min(1),
  datasetId: z.string().min(1).optional(),
  parameter: canonicalParameterSchema,
  min: z.number().finite(),
  max: z.number().finite(),
  unit: z.string().optional(),
  createdAt: z.string().min(1),
}).refine((config) => config.min <= config.max, {
  message: "Minimum range value must be less than or equal to maximum range value.",
  path: ["max"],
});

export const analyzeRequestSchema = z.object({
  datasetId: z.string().min(1),
  sourceType: z.enum(["mock", "uploaded"]),
  sourceName: z.string().min(1).optional(),
  axis: recognizedColumnSchema.pick({ canonicalName: true, unit: true }),
  parameters: z.array(recognizedColumnSchema.pick({ canonicalName: true, unit: true })).min(1),
  measurements: z.array(drillingMeasurementSchema).min(1).max(MAX_CSV_ROW_COUNT),
  qualityWarnings: z.array(dataQualityWarningSchema).optional().default([]),
  metricConfigs: z.array(alertMetricConfigSchema).max(MAX_ALERT_METRIC_CONFIG_COUNT).optional().default([]),
});

export type UploadFormValues = z.infer<typeof uploadFormSchema>;
export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;
