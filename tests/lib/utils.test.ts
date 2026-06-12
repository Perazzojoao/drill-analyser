import { describe, expect, it } from "vitest";
import { formatChartAxisNumber } from "@/lib/utils";

function expectShortLabels(labels: string[]) {
  for (const label of labels) {
    expect(label.length, label).toBeLessThanOrEqual(5);
  }
}

describe("formatChartAxisNumber", () => {
  it("formats zero, positives, negatives, and common decimals within five characters", () => {
    const labels = [
      formatChartAxisNumber(0),
      formatChartAxisNumber(12.345),
      formatChartAxisNumber(-12.345),
      formatChartAxisNumber(0.123456),
      formatChartAxisNumber(-0.123456),
    ];

    expect(labels).toEqual(["0", "12.35", "-12.3", "0.123", "-0.12"]);
    expectShortLabels(labels);
  });

  it("formats small decimals without scientific notation when three fractional digits are useful", () => {
    const labels = [
      formatChartAxisNumber(0.003),
      formatChartAxisNumber(0.003456),
      formatChartAxisNumber(0.0099),
      formatChartAxisNumber(-0.003),
      formatChartAxisNumber(-0.0099),
    ];

    expect(labels).toEqual(["0.003", "0.003", "0.01", "-.003", "-0.01"]);
    expectShortLabels(labels);
  });

  it("uses scientific notation for tiny decimals below three-decimal precision", () => {
    const labels = [formatChartAxisNumber(0.00000123456789), formatChartAxisNumber(-0.00000123456789)];

    expect(labels).toEqual(["1e-6", "-1e-6"]);
    expectShortLabels(labels);
  });

  it("uses compact notation for thousands and millions", () => {
    const labels = [formatChartAxisNumber(1_234), formatChartAxisNumber(-1_234), formatChartAxisNumber(12_345), formatChartAxisNumber(1_234_567)];

    expect(labels).toEqual(["1.23K", "-1.2K", "12.3K", "1.23M"]);
    expectShortLabels(labels);
  });

  it("uses short scientific labels for very large values", () => {
    const labels = [formatChartAxisNumber(1e21), formatChartAxisNumber(-1.23456789e21)];

    expect(labels).toEqual(["1e21", "-1e21"]);
    expectShortLabels(labels);
  });

  it("keeps non-finite and string fallbacks within five characters", () => {
    const labels = [formatChartAxisNumber(Number.NaN), formatChartAxisNumber(Infinity), formatChartAxisNumber(-Infinity), formatChartAxisNumber("not-a-number")];

    expect(labels).toEqual(["NaN", "∞", "-∞", "not-a"]);
    expectShortLabels(labels);
  });
});
