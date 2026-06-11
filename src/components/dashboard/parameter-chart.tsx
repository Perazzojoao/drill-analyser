"use client";

import { TriangleAlert } from "lucide-react";
import { useMemo } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ParameterChart as ParameterChartModel } from "@/lib/drilling/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ParameterChartProps {
  chart: ParameterChartModel;
  colorIndex?: number;
}

const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

export function ParameterChart({ chart, colorIndex = 0 }: ParameterChartProps) {
  const series = chart.series[0];
  const data = useMemo(
    () => series?.points.map((point) => ({ x: point.x, y: point.y, rowIndex: point.rowIndex })) ?? [],
    [series?.points],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{chart.title}</CardTitle>
        <CardDescription className="flex items-center gap-2">
          <span>{chart.emptyReason ?? `${series?.label ?? "Parameter"} plotted against ${chart.axisLabel}.`}</span>
          {chart.highlightedFindings.length > 0 ? (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning"
              aria-label={`${chart.highlightedFindings.length} alert highlight${chart.highlightedFindings.length === 1 ? "" : "s"} detected`}
            >
              <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
              {chart.highlightedFindings.length}
            </span>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="h-72">
        {series && data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
              <XAxis dataKey="x" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
              <YAxis tickLine={false} axisLine={false} tickMargin={8} width={48} />
              <Tooltip
                cursor={{ stroke: "var(--border)" }}
                contentStyle={{
                  background: "var(--popover)",
                  borderColor: "var(--border)",
                  color: "var(--popover-foreground)",
                }}
                labelFormatter={(label) => `${chart.axisLabel}: ${label}`}
                formatter={(value) => [value, series.unit ? `${series.label} (${series.unit})` : series.label]}
              />
              <Line
                type="monotone"
                dataKey="y"
                name={series.label}
                stroke={CHART_COLORS[colorIndex % CHART_COLORS.length]}
                strokeWidth={2}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed text-center text-sm text-muted-foreground">
            {chart.emptyReason ?? "No data available for this chart."}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
