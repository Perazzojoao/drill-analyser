import type { DashboardMetric } from "@/lib/drilling/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatNumber } from "@/lib/utils";

interface MetricCardProps {
  metric: DashboardMetric;
}

export function MetricCard({ metric }: MetricCardProps) {
  const displayValue = typeof metric.value === "number" ? formatNumber(metric.value) : metric.value;

  return (
    <Card className={cn(metric.severity === "warning" && "border-warning/50")}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{metric.label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight">
          {displayValue}
          {metric.unit ? <span className="ml-1 text-sm font-normal text-muted-foreground">{metric.unit}</span> : null}
        </div>
        {metric.description ? <p className="mt-2 text-sm text-muted-foreground">{metric.description}</p> : null}
      </CardContent>
    </Card>
  );
}
