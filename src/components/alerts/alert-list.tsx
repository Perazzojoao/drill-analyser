"use client";

import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AlertNotification } from "@/lib/drilling/types";

interface AlertListProps {
  alerts: AlertNotification[];
  totalCount?: number;
  onDismiss?: (alertId: string) => void;
}

export function AlertList({ alerts, totalCount = alerts.length, onDismiss }: AlertListProps) {
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
      <CardContent className="space-y-3">
        {alerts.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">All alerts are dismissed for the current dataset.</div>
        ) : (
          alerts.map((alert) => <AlertItem key={alert.id} alert={alert} onDismiss={onDismiss} />)
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
      <Icon className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>{alert.title}</AlertTitle>
      <AlertDescription>{alert.message}</AlertDescription>
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
