import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PARAMETER_DEFINITIONS } from "@/lib/drilling/aliases";
import { unavailableParameterDescriptions } from "@/lib/drilling/metrics";
import type { DrillingDataset } from "@/lib/drilling/types";

interface DataPreviewProps {
  dataset: DrillingDataset;
}

export function DataPreview({ dataset }: DataPreviewProps) {
  const unavailable = unavailableParameterDescriptions(dataset);
  const previewRows = dataset.measurements.slice(0, 5);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Recognized data</CardTitle>
          <CardDescription>
            Axis and parameters detected from {dataset.sourceName}. Large row arrays are kept in memory only.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-3">
            <p className="text-sm text-muted-foreground">Axis</p>
            <p className="font-medium">
              {PARAMETER_DEFINITIONS[dataset.axis.canonicalName].label}
              {dataset.axis.unit ? ` (${dataset.axis.unit})` : ""} from {dataset.axis.sourceName}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {dataset.parameters.map((parameter) => (
              <div key={`${parameter.sourceName}-${parameter.canonicalName}`} className="rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
                  <p className="font-medium">{PARAMETER_DEFINITIONS[parameter.canonicalName].label}</p>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {parameter.sourceName}{parameter.unit ? ` · ${parameter.unit}` : ""} · {parameter.validValueCount} usable
                </p>
              </div>
            ))}
          </div>
          {unavailable.length > 0 ? (
            <div className="rounded-lg border border-dashed p-3">
              <p className="text-sm font-medium">Unavailable optional parameters</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {unavailable.map((message) => <li key={message}>{message}</li>)}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data quality</CardTitle>
          <CardDescription>Warnings explain sparse, invalid, malformed, or unrecognized data without blocking available charts.</CardDescription>
        </CardHeader>
        <CardContent>
          {dataset.qualityWarnings.length > 0 ? (
            <ul className="space-y-2">
              {dataset.qualityWarnings.map((warning) => (
                <li key={warning.id} className="flex gap-2 rounded-lg border p-3 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-warning" aria-hidden="true" />
                  <span>{warning.message}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No data-quality warnings found.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preview rows</CardTitle>
          <CardDescription>First rows after normalization.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b text-muted-foreground">
              <tr>
                <th className="py-2 pr-4">Row</th>
                <th className="py-2 pr-4">Axis</th>
                {dataset.parameters.map((parameter) => <th key={parameter.canonicalName} className="py-2 pr-4">{PARAMETER_DEFINITIONS[parameter.canonicalName].label}</th>)}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row) => (
                <tr key={row.index} className="border-b last:border-0">
                  <td className="py-2 pr-4">{row.index + 1}</td>
                  <td className="py-2 pr-4">{row.axisValue}</td>
                  {dataset.parameters.map((parameter) => (
                    <td key={parameter.canonicalName} className="py-2 pr-4">
                      {row.values[parameter.canonicalName] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
