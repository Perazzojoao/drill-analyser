import type { DashboardMetric } from "@/lib/drilling/types";
import { MetricCard } from "./metric-card";

interface MetricGridProps {
  metrics: DashboardMetric[];
}

export function MetricGrid({ metrics }: MetricGridProps) {
  return (
    <section aria-label="Dashboard metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <MetricCard key={metric.id} metric={metric} />
      ))}
    </section>
  );
}
