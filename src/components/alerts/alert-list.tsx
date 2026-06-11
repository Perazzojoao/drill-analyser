"use client";

import { AlertCircle, CheckCircle2, Info, Search, TriangleAlert, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
import type { AlertNotification, CanonicalParameter } from "@/lib/drilling/types";
import { clamp, cn } from "@/lib/utils";

interface AlertListProps {
  alerts: AlertNotification[];
  totalCount?: number;
  onDismiss?: (alertId: string) => void;
}

type AlertTypeFilter = AlertNotification["rule"] | "all";
type ParameterFilter = CanonicalParameter | "all";
type AlertFilterState = {
  datasetKey: string;
  type: AlertTypeFilter;
  parameter: ParameterFilter;
  search: string;
};
type AlertPaginationState = {
  filterKey: string;
  page: number;
};

const ALERTS_PER_PAGE = 10;

const ALERT_RULE_LABELS: Record<string, string> = {
  "fixed-range": "Fixed range",
  "spike-drop": "Spike/drop",
  "missing-cluster": "Missing cluster",
  "sparse-data": "Sparse data",
  "invalid-values": "Invalid values",
  "possible-kick-influx": "Possible kick/influx",
  "possible-washout": "Possible washout",
  "possible-stuck-pipe": "Possible stuck pipe",
  "bit-balling-proxy": "Bit balling proxy",
  "limited-horizontal-signals": "Limited signal screening",
};

function getAlertRuleLabel(rule: string) {
  return ALERT_RULE_LABELS[rule] ?? rule.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

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

function alertMatchesSearch(alert: AlertNotification, searchTerm: string) {
  if (!searchTerm) return true;

  const searchableText = [
    alert.title,
    alert.message,
    getAlertRuleLabel(alert.rule),
    alert.rule,
    alert.severity,
    alert.parameter ? PARAMETER_DEFINITIONS[alert.parameter].label : undefined,
    alert.parameter,
    alert.rowIndex !== undefined ? `row ${alert.rowIndex + 1}` : undefined,
    alert.id,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return searchableText.includes(searchTerm);
}

export function AlertList({ alerts, totalCount = alerts.length, onDismiss }: AlertListProps) {
  const alertDatasetKey = alerts[0]?.datasetId ?? "none";
  const [alertFilters, setAlertFilters] = useState<AlertFilterState>({
    datasetKey: alertDatasetKey,
    type: "all",
    parameter: "all",
    search: "",
  });
  const [alertPagination, setAlertPagination] = useState<AlertPaginationState>({ filterKey: "", page: 1 });

  const alertTypeOptions = useMemo(() => {
    return Array.from(new Set(alerts.map((alert) => alert.rule))).sort((a, b) =>
      getAlertRuleLabel(a).localeCompare(getAlertRuleLabel(b)),
    );
  }, [alerts]);

  const parameterOptions = useMemo(() => {
    return Array.from(new Set(alerts.map((alert) => alert.parameter).filter((parameter): parameter is CanonicalParameter => Boolean(parameter)))).sort(
      (a, b) => PARAMETER_DEFINITIONS[a].label.localeCompare(PARAMETER_DEFINITIONS[b].label),
    );
  }, [alerts]);

  const activeAlertTypeFilter =
    alertFilters.datasetKey === alertDatasetKey && (alertFilters.type === "all" || alertTypeOptions.includes(alertFilters.type))
      ? alertFilters.type
      : "all";
  const activeParameterFilter =
    alertFilters.datasetKey === alertDatasetKey &&
      (alertFilters.parameter === "all" || parameterOptions.includes(alertFilters.parameter))
      ? alertFilters.parameter
      : "all";
  const activeAlertSearch = alertFilters.datasetKey === alertDatasetKey ? alertFilters.search : "";

  const filteredAlerts = useMemo(() => {
    const normalizedSearch = activeAlertSearch.trim().toLowerCase();

    return alerts.filter((alert) => {
      const matchesType = activeAlertTypeFilter === "all" || alert.rule === activeAlertTypeFilter;
      const matchesParameter = activeParameterFilter === "all" || alert.parameter === activeParameterFilter;
      return matchesType && matchesParameter && alertMatchesSearch(alert, normalizedSearch);
    });
  }, [alerts, activeAlertSearch, activeAlertTypeFilter, activeParameterFilter]);

  const alertPageCount = Math.max(1, Math.ceil(filteredAlerts.length / ALERTS_PER_PAGE));
  const activeAlertFilterKey = `${alertDatasetKey}:${activeAlertTypeFilter}:${activeParameterFilter}:${activeAlertSearch.trim().toLowerCase()}`;
  const currentAlertsPage =
    alertPagination.filterKey === activeAlertFilterKey ? clamp(alertPagination.page, 1, alertPageCount) : 1;
  const paginatedAlerts = filteredAlerts.slice(
    (currentAlertsPage - 1) * ALERTS_PER_PAGE,
    currentAlertsPage * ALERTS_PER_PAGE,
  );
  const visibleAlertPages = getVisiblePages(currentAlertsPage, alertPageCount);
  const firstAlertNumber = filteredAlerts.length === 0 ? 0 : (currentAlertsPage - 1) * ALERTS_PER_PAGE + 1;
  const lastAlertNumber = Math.min(currentAlertsPage * ALERTS_PER_PAGE, filteredAlerts.length);

  const goToAlertsPage = (page: number) => {
    setAlertPagination({ filterKey: activeAlertFilterKey, page: clamp(page, 1, alertPageCount) });
  };

  if (totalCount === 0) {
    return (
      <Card id="alerts">
        <CardHeader>
          <CardTitle>No alerts detected</CardTitle>
          <CardDescription>The active dataset passed the current fixed-rule anomaly checks.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-info" aria-hidden="true" />
          Upload another CSV or keep reviewing the current charts.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card id="alerts">
      <CardHeader>
        <CardTitle>Alerts</CardTitle>
        <CardDescription>
          {alerts.length} active of {totalCount} detected alert(s). Dismissals apply to this browser session and reset when the dataset changes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {alerts.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">All alerts are dismissed for the current dataset.</div>
        ) : (
          <>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(10rem,14rem)_minmax(10rem,14rem)]">
              <label className="space-y-2">
                <span className="text-sm font-medium">Search alerts</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    value={activeAlertSearch}
                    onChange={(event) =>
                      setAlertFilters((filters) => ({
                        datasetKey: alertDatasetKey,
                        type: filters.datasetKey === alertDatasetKey ? activeAlertTypeFilter : "all",
                        parameter: filters.datasetKey === alertDatasetKey ? activeParameterFilter : "all",
                        search: event.target.value,
                      }))
                    }
                    placeholder="Search title, message, type, parameter, or row"
                    className="pl-9"
                  />
                </div>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Alert type</span>
                <Select
                  value={activeAlertTypeFilter}
                  onValueChange={(value) =>
                    setAlertFilters({
                      datasetKey: alertDatasetKey,
                      type: value as AlertTypeFilter,
                      parameter: activeParameterFilter,
                      search: activeAlertSearch,
                    })
                  }
                >
                  <SelectTrigger className="w-full bg-background">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {alertTypeOptions.map((type) => (
                      <SelectItem key={type} value={type}>{getAlertRuleLabel(type)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Parameter</span>
                <Select
                  value={activeParameterFilter}
                  onValueChange={(value) =>
                    setAlertFilters({
                      datasetKey: alertDatasetKey,
                      type: activeAlertTypeFilter,
                      parameter: value as ParameterFilter,
                      search: activeAlertSearch,
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
                Showing {firstAlertNumber}-{lastAlertNumber} of {filteredAlerts.length} filtered active alerts
                {filteredAlerts.length !== alerts.length ? ` (${alerts.length} active total)` : ""}.
              </p>
              <p>{ALERTS_PER_PAGE} alerts per page</p>
            </div>

            {paginatedAlerts.length > 0 ? (
              <div className="space-y-3">
                {paginatedAlerts.map((alert) => <AlertItem key={alert.id} alert={alert} onDismiss={onDismiss} />)}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                No alerts match the selected filters or search.
              </div>
            )}

            {alertPageCount > 1 ? (
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#alerts"
                      aria-disabled={currentAlertsPage === 1}
                      className={cn(currentAlertsPage === 1 && "pointer-events-none opacity-50")}
                      onClick={(event) => {
                        event.preventDefault();
                        goToAlertsPage(currentAlertsPage - 1);
                      }}
                    />
                  </PaginationItem>
                  {visibleAlertPages.map((page) => (
                    <PaginationItem key={page}>
                      {typeof page === "number" ? (
                        <PaginationLink
                          href="#alerts"
                          isActive={page === currentAlertsPage}
                          onClick={(event) => {
                            event.preventDefault();
                            goToAlertsPage(page);
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
                      href="#alerts"
                      aria-disabled={currentAlertsPage === alertPageCount}
                      className={cn(currentAlertsPage === alertPageCount && "pointer-events-none opacity-50")}
                      onClick={(event) => {
                        event.preventDefault();
                        goToAlertsPage(currentAlertsPage + 1);
                      }}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function AlertItem({ alert, onDismiss }: { alert: AlertNotification; onDismiss?: (alertId: string) => void }) {
  const Icon = alert.severity === "critical" ? AlertCircle : alert.severity === "warning" ? TriangleAlert : Info;
  const variant = alert.severity === "critical" ? "destructive" : alert.severity === "warning" ? "warning" : "info";

  return (
    <Alert variant={variant} className="pr-12">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <AlertTitle>{alert.title}</AlertTitle>
          <AlertDescription>{alert.message}</AlertDescription>
        </div>
      </div>
      {onDismiss ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 h-8 w-8"
          aria-label={`Dismiss ${alert.title}`}
          onClick={() => onDismiss(alert.id)}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      ) : null}
    </Alert>
  );
}
