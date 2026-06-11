"use client";

import { AlertCircle, AlertTriangle, Database } from "lucide-react";
import { useEffect, useMemo } from "react";
import { AlertList } from "@/components/alerts/alert-list";
import { AppHeader } from "@/components/app-shell/app-header";
import { AppSidebar, buildNavigationItems } from "@/components/app-shell/app-sidebar";
import { MetricGrid } from "@/components/dashboard/metric-grid";
import { ParameterChart } from "@/components/dashboard/parameter-chart";
import { CsvUploadForm } from "@/components/upload/csv-upload-form";
import { DataPreview } from "@/components/upload/data-preview";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDrillingAnalysis } from "@/hooks/use-drilling-analysis";
import { useSampleDataset } from "@/hooks/use-sample-dataset";
import { buildParameterCharts, calculateDashboardMetrics } from "@/lib/drilling/metrics";
import type { AnomalyFinding, DashboardSection, DrillingDataset, ParameterChart as ParameterChartModel } from "@/lib/drilling/types";
import { useDashboardStore } from "@/lib/stores/dashboard-store";

export default function Home() {
  const sampleDataset = useSampleDataset();
  const activeDataset = useDashboardStore((state) => state.activeDataset);
  const activeSection = useDashboardStore((state) => state.activeSection);
  const setActiveDataset = useDashboardStore((state) => state.setActiveDataset);
  const setActiveSection = useDashboardStore((state) => state.setActiveSection);
  const dismissAlert = useDashboardStore((state) => state.dismissAlert);
  const dismissedAlertIds = useDashboardStore((state) => state.dismissedAlertIds);

  useEffect(() => {
    if (sampleDataset.data && !activeDataset) {
      setActiveDataset(sampleDataset.data);
    }
  }, [activeDataset, sampleDataset.data, setActiveDataset]);

  const dataset = activeDataset ?? sampleDataset.data;
  const analysis = useDrillingAnalysis(dataset);
  const allAlerts = useMemo(() => analysis.data?.alerts ?? [], [analysis.data?.alerts]);
  const activeAlerts = useMemo(
    () => allAlerts.filter((alert) => !dismissedAlertIds.includes(alert.id)),
    [allAlerts, dismissedAlertIds],
  );
  const metrics = useMemo(
    () => analysis.data?.metrics ?? (dataset ? calculateDashboardMetrics(dataset, allAlerts.length) : []),
    [allAlerts.length, analysis.data?.metrics, dataset],
  );
  const charts = useMemo(
    () => (dataset ? withChartHighlights(buildParameterCharts(dataset), analysis.data?.findings ?? []) : []),
    [analysis.data?.findings, dataset],
  );
  const alertCount = activeAlerts.length;
  const mobileNavigationItems = useMemo(() => buildNavigationItems(activeSection, alertCount), [activeSection, alertCount]);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <AppSidebar alertCount={alertCount} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader />
        <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 sm:p-6 lg:px-8">
          <MobileNav items={mobileNavigationItems} onSelect={setActiveSection} />
          {sampleDataset.isLoading && !dataset ? <DashboardLoading /> : null}
          {sampleDataset.isError && !dataset ? <DashboardError message={sampleDataset.error.message} onRetry={() => sampleDataset.refetch()} /> : null}
          {dataset ? (
            <>
              <section id="dashboard" className="space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground">
                      <Database className="h-4 w-4" aria-hidden="true" />
                      {dataset.isSample ? "Sample data" : "Uploaded data"}
                    </p>
                    <h2 className="mt-3 text-3xl font-semibold tracking-tight">{dataset.sourceName}</h2>
                    <p className="text-muted-foreground">
                      {dataset.rowCount} rows loaded with {dataset.parameters.length} recognized parameters.
                    </p>
                  </div>
                </div>
              </section>

              <div className="space-y-6">
                <MetricGrid metrics={metrics} />
                <AlertSummaryCards activeCount={activeAlerts.length} totalCount={allAlerts.length} isAnalyzing={analysis.isFetching} />
              </div>

              {activeSection === "dashboard" ? (
                <section className="grid gap-4 lg:grid-cols-2" aria-label="Parameter charts">
                  {charts.slice(0, 4).map((chart, index) => (
                    <ParameterChart key={chart.id} chart={chart} colorIndex={index} />
                  ))}
                </section>
              ) : null}

              {analysis.isError ? <AnalysisError message={analysis.error.message} /> : null}
              {activeSection === "upload" ? <UploadSection dataset={dataset} /> : null}
              {activeSection === "alerts" ? (
                <AlertList alerts={activeAlerts} totalCount={allAlerts.length} onDismiss={dismissAlert} />
              ) : null}
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
}

function DashboardLoading() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Loading sample drilling data</CardTitle>
        <CardDescription>Preparing the first-load dashboard.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-2 rounded-full bg-muted">
          <div className="h-2 w-1/3 animate-pulse rounded-full bg-primary" />
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>Sample data unavailable</AlertTitle>
      <AlertDescription className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span>{message}</span>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </AlertDescription>
    </Alert>
  );
}

function MobileNav({ items, onSelect }: { items: ReturnType<typeof buildNavigationItems>; onSelect: (section: DashboardSection) => void }) {
  return (
    <nav className="sticky top-16 z-20 grid gap-2 rounded-xl border bg-background/95 p-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:grid-cols-3 lg:hidden" aria-label="Dashboard sections">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Button
            key={item.id}
            variant={item.active ? "secondary" : "ghost"}
            className="justify-start sm:justify-center"
            onClick={() => onSelect(item.id)}
            aria-current={item.active ? "page" : undefined}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span className="truncate">{item.label}</span>
            {item.badgeCount ? <span className="rounded-full bg-warning px-2 py-0.5 text-xs text-foreground">{item.badgeCount}</span> : null}
          </Button>
        );
      })}
    </nav>
  );
}

function UploadSection({ dataset }: { dataset: DrillingDataset }) {
  return (
    <section id="upload" className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Upload/Data Preview</CardTitle>
          <CardDescription>
            Upload a local CSV to replace the sample dataset for this browser session. Invalid uploads keep the last valid dataset visible.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CsvUploadForm />
        </CardContent>
      </Card>
      <DataPreview dataset={dataset} />
    </section>
  );
}

function AnalysisError({ message }: { message: string }) {
  return (
    <Alert variant="warning">
      <AlertTriangle className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>Analysis unavailable</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

function AlertSummaryCards({ activeCount, totalCount, isAnalyzing }: { activeCount: number; totalCount: number; isAnalyzing: boolean }) {
  return (
    <section className="grid gap-4 md:grid-cols-2" aria-label="Alert summary">
      <Card>
        <CardHeader>
          <CardTitle>Active Alerts</CardTitle>
          <CardDescription>{isAnalyzing ? "Analyzing the active dataset." : "Dismissible findings for this session."}</CardDescription>
        </CardHeader>
        <CardContent className="text-3xl font-semibold">{activeCount}</CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Total Findings</CardTitle>
          <CardDescription>Fixed-range, spike/drop, missing-cluster, and quality findings.</CardDescription>
        </CardHeader>
        <CardContent className="text-3xl font-semibold">{totalCount}</CardContent>
      </Card>
    </section>
  );
}

function withChartHighlights(charts: ParameterChartModel[], findings: AnomalyFinding[]): ParameterChartModel[] {
  return charts.map((chart) => ({
    ...chart,
    highlightedFindings: findings
      .filter((finding) => chart.series.some((series) => series.parameter === finding.parameter))
      .map((finding) => finding.id),
  }));
}
