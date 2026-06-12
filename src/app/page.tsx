"use client";

import { AlertList } from "@/components/alerts/alert-list";
import { AlertMetricConfigManager } from "@/components/alerts/alert-metric-config-manager";
import { AlertMetricConfigurator } from "@/components/alerts/alert-metric-configurator";
import { AppHeader } from "@/components/app-shell/app-header";
import { AppSidebar, buildNavigationItems } from "@/components/app-shell/app-sidebar";
import { MetricGrid } from "@/components/dashboard/metric-grid";
import { ParameterChart } from "@/components/dashboard/parameter-chart";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SidebarProvider } from "@/components/ui/sidebar";
import { CsvUploadForm } from "@/components/upload/csv-upload-form";
import { DataPreview } from "@/components/upload/data-preview";
import { useDrillingAnalysis } from "@/hooks/use-drilling-analysis";
import { useSampleDataset } from "@/hooks/use-sample-dataset";
import { filterMetricConfigsForDataset } from "@/lib/drilling/metric-configs";
import { buildParameterCharts, calculateDashboardMetrics } from "@/lib/drilling/metrics";
import type { AnomalyFinding, DashboardSection, DrillingDataset, ParameterChart as ParameterChartModel } from "@/lib/drilling/types";
import { useDashboardStore } from "@/lib/stores/dashboard-store";
import { cn } from "@/lib/utils";
import { AlertCircle, AlertTriangle, ChevronDown, Database } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

export default function Home() {
  const sampleDataset = useSampleDataset();
  const activeDataset = useDashboardStore((state) => state.activeDataset);
  const activeSection = useDashboardStore((state) => state.activeSection);
  const setActiveDataset = useDashboardStore((state) => state.setActiveDataset);
  const setActiveSection = useDashboardStore((state) => state.setActiveSection);
  const dismissAlert = useDashboardStore((state) => state.dismissAlert);
  const dismissedAlertIds = useDashboardStore((state) => state.dismissedAlertIds);
  const metricConfigs = useDashboardStore((state) => state.metricConfigs);
  const addMetricConfig = useDashboardStore((state) => state.addMetricConfig);
  const updateMetricConfig = useDashboardStore((state) => state.updateMetricConfig);
  const removeMetricConfig = useDashboardStore((state) => state.removeMetricConfig);
  const removeMetricConfigsForDataset = useDashboardStore((state) => state.removeMetricConfigsForDataset);
  const [isMobileHeaderHidden, setIsMobileHeaderHidden] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isMobileNavInteractionActive, setIsMobileNavInteractionActive] = useState(false);
  const mobileNavInteractionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMobileHeaderHiddenChange = useCallback((hidden: boolean) => {
    setIsMobileHeaderHidden(hidden);
  }, []);

  const handleMobileNavInteraction = useCallback(() => {
    setIsMobileNavInteractionActive(true);

    if (mobileNavInteractionTimeoutRef.current) {
      clearTimeout(mobileNavInteractionTimeoutRef.current);
    }

    mobileNavInteractionTimeoutRef.current = setTimeout(() => {
      setIsMobileNavInteractionActive(false);
      mobileNavInteractionTimeoutRef.current = null;
    }, 300);
  }, []);

  useEffect(() => {
    return () => {
      if (mobileNavInteractionTimeoutRef.current) {
        clearTimeout(mobileNavInteractionTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (sampleDataset.data && !activeDataset) {
      setActiveDataset(sampleDataset.data);
    }
  }, [activeDataset, sampleDataset.data, setActiveDataset]);

  const dataset = activeDataset ?? sampleDataset.data;
  const activeMetricConfigs = useMemo(
    () => (dataset ? filterMetricConfigsForDataset(metricConfigs, dataset) : []),
    [dataset, metricConfigs],
  );
  const analysis = useDrillingAnalysis(dataset, activeMetricConfigs);
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
    <SidebarProvider>
      <div className="flex min-h-screen bg-background text-foreground">
        <AppSidebar alertCount={alertCount} />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader
            isHiddenOnMobile={isMobileHeaderHidden}
            onHiddenOnMobileChange={handleMobileHeaderHiddenChange}
            suppressMobileHide={isMobileNavInteractionActive}
          />
          <main className="mx-auto flex w-full flex-1 flex-col gap-6 p-4 sm:p-6 lg:px-8">
            <MobileNav
              items={mobileNavigationItems}
              onSelect={setActiveSection}
              isHeaderHidden={isMobileHeaderHidden}
              open={isMobileNavOpen}
              onOpenChange={setIsMobileNavOpen}
              onInteraction={handleMobileNavInteraction}
            />
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
                  <AlertSummaryCards
                    activeCount={activeAlerts.length}
                    totalCount={allAlerts.length}
                    isAnalyzing={analysis.isFetching}
                    hasMetricConfigs={activeMetricConfigs.length > 0}
                  />
                </div>

                {activeSection === "dashboard" ? (
                  <section className="grid gap-4 lg:grid-cols-2" aria-label="Parameter charts">
                    {charts.map((chart, index) => {
                      const isLastOddChart = charts.length % 2 === 1 && index === charts.length - 1;

                      return (
                        <div key={chart.id} className={cn(isLastOddChart && "lg:col-span-2")}>
                          <ParameterChart chart={chart} colorIndex={index} />
                        </div>
                      );
                    })}
                  </section>
                ) : null}

                {analysis.isError ? <AnalysisError message={analysis.error.message} /> : null}
                {activeSection === "upload" ? <UploadSection dataset={dataset} /> : null}
                {activeSection === "metrics" ? (
                  <section id="metrics" className="space-y-4">
                    <AlertMetricConfigurator
                      dataset={dataset}
                      configs={activeMetricConfigs}
                      onAddConfig={addMetricConfig}
                      onRemoveConfig={removeMetricConfig}
                      storedMetricsAction={
                        <AlertMetricConfigManager
                          configs={metricConfigs}
                          activeDataset={dataset}
                          onUpdateConfig={updateMetricConfig}
                          onRemoveConfig={removeMetricConfig}
                          onRemoveDatasetConfigs={removeMetricConfigsForDataset}
                        />
                      }
                    />
                  </section>
                ) : null}
                {activeSection === "alerts" ? (
                  <AlertList alerts={activeAlerts} totalCount={allAlerts.length} hasMetricConfigs={activeMetricConfigs.length > 0} onDismiss={dismissAlert} />
                ) : null}
              </>
            ) : null}
          </main>
        </div>
      </div>
    </SidebarProvider>
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

function MobileNav({
  items,
  onSelect,
  isHeaderHidden,
  open,
  onOpenChange,
  onInteraction,
}: {
  items: ReturnType<typeof buildNavigationItems>;
  onSelect: (section: DashboardSection) => void;
  isHeaderHidden: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInteraction: () => void;
}) {
  const menuId = useId();
  const activeItem = items.find((item) => item.active) ?? items[0];
  const ActiveIcon = activeItem.icon;

  return (
    <nav
      className={cn(
        "sticky top-16 z-20 mx-auto w-fit max-w-full transition-transform duration-200 ease-out lg:hidden",
        isHeaderHidden && "-translate-y-12",
      )}
      aria-label="Dashboard sections"
    >
      <div className="grid">
        <div aria-hidden="true" className="invisible col-start-1 row-start-1 grid pointer-events-none">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <span key={item.id} className="col-start-1 row-start-1 inline-flex h-10 items-center gap-2 whitespace-nowrap px-4 text-sm font-medium">
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
                {item.badgeCount ? <span className="rounded-full px-2 py-0.5 text-xs">{item.badgeCount}</span> : null}
                <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
              </span>
            );
          })}
        </div>
        <Button
          type="button"
          variant="outline"
          className="col-start-1 row-start-1 min-w-full justify-between rounded-xl border bg-background/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80"
          onClick={() => {
            onInteraction();
            onOpenChange(!open);
          }}
          onPointerDown={onInteraction}
          aria-expanded={open}
          aria-controls={menuId}
        >
          <span className="flex min-w-0 items-center gap-2">
            <ActiveIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{activeItem.label}</span>
            {activeItem.badgeCount ? <span className="rounded-full bg-warning px-2 py-0.5 text-xs text-foreground">{activeItem.badgeCount}</span> : null}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 transition-transform data-[open=true]:rotate-180" data-open={open} aria-hidden="true" />
        </Button>
      </div>
      {open ? (
        <div
          id={menuId}
          className="mt-2 grid w-full max-w-[calc(100vw-2rem)] gap-2 rounded-xl border bg-background/95 p-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80"
        >
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.id}
                variant={item.active ? "secondary" : "ghost"}
                className="w-full justify-start"
                onClick={() => {
                  onInteraction();
                  onSelect(item.id);
                  onOpenChange(false);
                }}
                aria-current={item.active ? "page" : undefined}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
                {item.badgeCount ? <span className="rounded-full bg-warning px-2 py-0.5 text-xs text-foreground">{item.badgeCount}</span> : null}
              </Button>
            );
          })}
        </div>
      ) : null}
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

function AlertSummaryCards({
  activeCount,
  totalCount,
  isAnalyzing,
  hasMetricConfigs,
}: {
  activeCount: number;
  totalCount: number;
  isAnalyzing: boolean;
  hasMetricConfigs: boolean;
}) {
  return (
    <section className="grid gap-4 md:grid-cols-2" aria-label="Alert summary">
      <Card>
        <CardHeader>
          <CardTitle>Active Alerts</CardTitle>
          <CardDescription>{hasMetricConfigs ? (isAnalyzing ? "Analyzing configured ranges." : "Dismissible configured-range alerts.") : "Add metrics to start visualizing alerts."}</CardDescription>
        </CardHeader>
        <CardContent className="text-3xl font-semibold">{activeCount}</CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Total Findings</CardTitle>
          <CardDescription>{hasMetricConfigs ? "Measurements outside user-configured ranges." : "No user-configured alert metrics yet."}</CardDescription>
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
