"use client";

import { AlertTriangle, CheckCircle2, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PARAMETER_DEFINITIONS } from "@/lib/drilling/aliases";
import { unavailableParameterDescriptions } from "@/lib/drilling/metrics";
import type { CanonicalParameter, DataQualityWarning, DrillingDataset } from "@/lib/drilling/types";
import { clamp, cn } from "@/lib/utils";

interface DataPreviewProps {
  dataset: DrillingDataset;
}

type WarningTypeFilter = DataQualityWarning["type"] | "all";
type ParameterFilter = CanonicalParameter | "all";
type WarningFilterState = {
  datasetKey: string;
  type: WarningTypeFilter;
  parameter: ParameterFilter;
  search: string;
};
type WarningPaginationState = {
  filterKey: string;
  page: number;
};

const WARNINGS_PER_PAGE = 10;

const WARNING_TYPE_LABELS: Record<DataQualityWarning["type"], string> = {
  "missing-values": "Missing values",
  "invalid-values": "Invalid values",
  "sparse-data": "Sparse data",
  "malformed-row": "Malformed row",
  "unrecognized-column": "Unrecognized column",
  "missing-axis": "Missing axis",
};

function getVisiblePages(currentPage: number, pageCount: number): Array<number | "ellipsis-start" | "ellipsis-end"> {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "ellipsis-end", pageCount];
  }

  if (currentPage >= pageCount - 3) {
    return [1, "ellipsis-start", pageCount - 4, pageCount - 3, pageCount - 2, pageCount - 1, pageCount];
  }

  return [1, "ellipsis-start", currentPage - 1, currentPage, currentPage + 1, "ellipsis-end", pageCount];
}

function warningMatchesSearch(warning: DataQualityWarning, searchTerm: string) {
  if (!searchTerm) return true;

  const searchableText = [
    warning.message,
    WARNING_TYPE_LABELS[warning.type],
    warning.severity,
    warning.column,
    warning.parameter ? PARAMETER_DEFINITIONS[warning.parameter].label : undefined,
    warning.parameter,
    warning.id,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return searchableText.includes(searchTerm);
}

export function DataPreview({ dataset }: DataPreviewProps) {
  const unavailable = unavailableParameterDescriptions(dataset);
  const datasetFilterKey = `${dataset.id}:${dataset.sourceType}:${dataset.sourceName}`;
  const [warningFilters, setWarningFilters] = useState<WarningFilterState>({
    datasetKey: datasetFilterKey,
    type: "all",
    parameter: "all",
    search: "",
  });
  const [warningPagination, setWarningPagination] = useState<WarningPaginationState>({ filterKey: "", page: 1 });

  const warningTypeOptions = useMemo(() => {
    return Array.from(new Set(dataset.qualityWarnings.map((warning) => warning.type))).sort((a, b) =>
      WARNING_TYPE_LABELS[a].localeCompare(WARNING_TYPE_LABELS[b]),
    );
  }, [dataset.qualityWarnings]);

  const parameterOptions = useMemo(() => {
    const parameters = new Set<CanonicalParameter>();

    dataset.parameters.forEach((parameter) => parameters.add(parameter.canonicalName));
    dataset.qualityWarnings.forEach((warning) => {
      if (warning.parameter) parameters.add(warning.parameter);
    });

    return Array.from(parameters).sort((a, b) =>
      PARAMETER_DEFINITIONS[a].label.localeCompare(PARAMETER_DEFINITIONS[b].label),
    );
  }, [dataset.parameters, dataset.qualityWarnings]);

  const activeWarningTypeFilter =
    warningFilters.datasetKey === datasetFilterKey &&
      (warningFilters.type === "all" || warningTypeOptions.includes(warningFilters.type))
      ? warningFilters.type
      : "all";
  const activeParameterFilter =
    warningFilters.datasetKey === datasetFilterKey &&
      (warningFilters.parameter === "all" || parameterOptions.includes(warningFilters.parameter))
      ? warningFilters.parameter
      : "all";
  const activeWarningSearch = warningFilters.datasetKey === datasetFilterKey ? warningFilters.search : "";

  const filteredWarnings = useMemo(() => {
    const normalizedSearch = activeWarningSearch.trim().toLowerCase();

    return dataset.qualityWarnings.filter((warning) => {
      const matchesType = activeWarningTypeFilter === "all" || warning.type === activeWarningTypeFilter;
      const matchesParameter = activeParameterFilter === "all" || warning.parameter === activeParameterFilter;
      return matchesType && matchesParameter && warningMatchesSearch(warning, normalizedSearch);
    });
  }, [dataset.qualityWarnings, activeWarningSearch, activeWarningTypeFilter, activeParameterFilter]);

  const warningPageCount = Math.max(1, Math.ceil(filteredWarnings.length / WARNINGS_PER_PAGE));
  const activeWarningFilterKey = `${dataset.id}:${activeWarningTypeFilter}:${activeParameterFilter}:${activeWarningSearch.trim().toLowerCase()}`;
  const currentWarningsPage =
    warningPagination.filterKey === activeWarningFilterKey ? clamp(warningPagination.page, 1, warningPageCount) : 1;
  const paginatedWarnings = filteredWarnings.slice(
    (currentWarningsPage - 1) * WARNINGS_PER_PAGE,
    currentWarningsPage * WARNINGS_PER_PAGE,
  );
  const visibleWarningPages = getVisiblePages(currentWarningsPage, warningPageCount);
  const firstWarningNumber = filteredWarnings.length === 0 ? 0 : (currentWarningsPage - 1) * WARNINGS_PER_PAGE + 1;
  const lastWarningNumber = Math.min(currentWarningsPage * WARNINGS_PER_PAGE, filteredWarnings.length);

  const goToWarningsPage = (page: number) => {
    setWarningPagination({ filterKey: activeWarningFilterKey, page: clamp(page, 1, warningPageCount) });
  };

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

      <Card id="data-quality-warnings">
        <CardHeader>
          <CardTitle>Data quality</CardTitle>
          <CardDescription>Warnings explain sparse, invalid, malformed, or unrecognized data without blocking available charts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {dataset.qualityWarnings.length > 0 ? (
            <>
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(10rem,14rem)_minmax(10rem,14rem)]">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Search warnings</span>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <Input
                      value={activeWarningSearch}
                      onChange={(event) =>
                        setWarningFilters((filters) => ({
                          datasetKey: datasetFilterKey,
                          type: filters.datasetKey === datasetFilterKey ? activeWarningTypeFilter : "all",
                          parameter: filters.datasetKey === datasetFilterKey ? activeParameterFilter : "all",
                          search: event.target.value,
                        }))
                      }
                      placeholder="Search message, column, type, or parameter"
                      className="pl-9"
                    />
                  </div>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Warning type</span>
                  <Select
                    value={activeWarningTypeFilter}
                    onValueChange={(value) =>
                      setWarningFilters({
                        datasetKey: datasetFilterKey,
                        type: value as WarningTypeFilter,
                        parameter: activeParameterFilter,
                        search: activeWarningSearch,
                      })
                    }
                  >
                    <SelectTrigger className="w-full bg-background">
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      {warningTypeOptions.map((type) => (
                        <SelectItem key={type} value={type}>{WARNING_TYPE_LABELS[type]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Parameter</span>
                  <Select
                    value={activeParameterFilter}
                    onValueChange={(value) =>
                      setWarningFilters({
                        datasetKey: datasetFilterKey,
                        type: activeWarningTypeFilter,
                        parameter: value as ParameterFilter,
                        search: activeWarningSearch,
                      })
                    }
                  >
                    <SelectTrigger className="w-full bg-background">
                      <SelectValue placeholder="All parameters" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All parameters</SelectItem>
                      {parameterOptions.map((parameter) => (
                        <SelectItem key={parameter} value={parameter}>{PARAMETER_DEFINITIONS[parameter].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              </div>

              <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <p>
                  Showing {firstWarningNumber}-{lastWarningNumber} of {filteredWarnings.length} filtered warnings
                  {filteredWarnings.length !== dataset.qualityWarnings.length ? ` (${dataset.qualityWarnings.length} total)` : ""}.
                </p>
                <p>{WARNINGS_PER_PAGE} warnings per page</p>
              </div>

              {paginatedWarnings.length > 0 ? (
                <ul className="space-y-2">
                  {paginatedWarnings.map((warning) => (
                    <li key={warning.id} className="flex gap-2 rounded-lg border p-3 text-sm">
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-warning" aria-hidden="true" />
                      <span>{warning.message}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                  No warnings match the selected filters or search.
                </p>
              )}

              {warningPageCount > 1 ? (
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#data-quality-warnings"
                        aria-disabled={currentWarningsPage === 1}
                        className={cn(currentWarningsPage === 1 && "pointer-events-none opacity-50")}
                        onClick={(event) => {
                          event.preventDefault();
                          goToWarningsPage(currentWarningsPage - 1);
                        }}
                      />
                    </PaginationItem>
                    {visibleWarningPages.map((page) => (
                      <PaginationItem key={page}>
                        {typeof page === "number" ? (
                          <PaginationLink
                            href="#data-quality-warnings"
                            isActive={page === currentWarningsPage}
                            onClick={(event) => {
                              event.preventDefault();
                              goToWarningsPage(page);
                            }}
                          >
                            {page}
                          </PaginationLink>
                        ) : (
                          <PaginationEllipsis />
                        )}
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext
                        href="#data-quality-warnings"
                        aria-disabled={currentWarningsPage === warningPageCount}
                        className={cn(currentWarningsPage === warningPageCount && "pointer-events-none opacity-50")}
                        onClick={(event) => {
                          event.preventDefault();
                          goToWarningsPage(currentWarningsPage + 1);
                        }}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No data-quality warnings found.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preview rows</CardTitle>
          <CardDescription>All loaded rows after normalization.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-[28rem] overflow-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4">Row</th>
                  <th className="py-2 pr-4">Axis</th>
                  {dataset.parameters.map((parameter) => <th key={parameter.canonicalName} className="py-2 pr-4">{PARAMETER_DEFINITIONS[parameter.canonicalName].label}</th>)}
                </tr>
              </thead>
              <tbody>
                {dataset.measurements.map((row) => (
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
