import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: 2,
    ...options,
  }).format(value);
}

const MAX_CHART_AXIS_LABEL_LENGTH = 5;

export function formatChartAxisNumber(value: number | string): string {
  const numericValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numericValue)) return formatNonFiniteAxisValue(value, numericValue);
  if (numericValue === 0) return "0";

  const absoluteValue = Math.abs(numericValue);

  if (absoluteValue >= 999.5) {
    return formatCompactAxisNumber(numericValue) ?? formatScientificAxisNumber(numericValue);
  }

  if (absoluteValue < 0.001) {
    return formatScientificAxisNumber(numericValue);
  }

  if (absoluteValue < 0.01) {
    return formatSmallDecimalAxisNumber(numericValue);
  }

  return formatStandardAxisNumber(numericValue) ?? formatScientificAxisNumber(numericValue);
}

function formatSmallDecimalAxisNumber(value: number): string {
  const formatted = trimAxisNumber(Math.abs(value).toFixed(3));
  const signed = value < 0 ? `-${formatted}` : formatted;

  return signed.length <= MAX_CHART_AXIS_LABEL_LENGTH ? signed : signed.replace("-0.", "-.");
}

function formatStandardAxisNumber(value: number): string | undefined {
  for (let significantDigits = 4; significantDigits >= 1; significantDigits -= 1) {
    const formatted = trimAxisNumber(value.toPrecision(significantDigits));
    if (formatted.length <= MAX_CHART_AXIS_LABEL_LENGTH) return formatted;
  }

  return undefined;
}

function formatCompactAxisNumber(value: number): string | undefined {
  const suffixes = ["", "K", "M", "B", "T"];
  let group = Math.min(Math.floor(Math.log10(Math.abs(value)) / 3), suffixes.length - 1);

  for (let decimals = 2; decimals >= 0; decimals -= 1) {
    const scale = 1000 ** group;
    const rounded = Number((value / scale).toFixed(decimals));

    if (Math.abs(rounded) >= 1000 && group < suffixes.length - 1) {
      group += 1;
      continue;
    }

    const formatted = `${trimAxisNumber(rounded.toFixed(decimals))}${suffixes[group]}`;
    if (formatted.length <= MAX_CHART_AXIS_LABEL_LENGTH) return formatted;
  }

  return undefined;
}

function formatScientificAxisNumber(value: number): string {
  const sign = value < 0 ? "-" : "";
  const exponent = Math.floor(Math.log10(Math.abs(value)));
  const exponentText = String(exponent);
  const availableMantissaLength = MAX_CHART_AXIS_LABEL_LENGTH - sign.length - 1 - exponentText.length;

  if (availableMantissaLength <= 0) {
    return exponent > 0 ? `${sign}big`.slice(0, MAX_CHART_AXIS_LABEL_LENGTH) : `${sign}tiny`.slice(0, MAX_CHART_AXIS_LABEL_LENGTH);
  }

  const fractionDigits = Math.max(0, availableMantissaLength - 2);
  const mantissa = trimAxisNumber((Math.abs(value) / 10 ** exponent).toFixed(fractionDigits));
  const formatted = `${sign}${mantissa}e${exponentText}`;

  return formatted.length <= MAX_CHART_AXIS_LABEL_LENGTH ? formatted : `${sign}1e${exponentText}`.slice(0, MAX_CHART_AXIS_LABEL_LENGTH);
}

function trimAxisNumber(value: string): string {
  const trimmed = value.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  return trimmed === "-0" ? "0" : trimmed;
}

function formatNonFiniteAxisValue(value: number | string, numericValue: number): string {
  if (numericValue === Infinity) return "∞";
  if (numericValue === -Infinity) return "-∞";
  if (typeof value === "number" && Number.isNaN(value)) return "NaN";

  return String(value).slice(0, MAX_CHART_AXIS_LABEL_LENGTH);
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${formatNumber(value, { maximumFractionDigits: exponent === 0 ? 0 : 1 })} ${units[exponent]}`;
}

export function createStableId(...parts: Array<string | number | undefined | null>): string {
  return parts
    .filter((part) => part !== undefined && part !== null && part !== "")
    .join(":")
    .toLowerCase()
    .replace(/[^a-z0-9:._-]+/g, "-")
    .replace(/-+/g, "-");
}

export function createDeterministicTimestamp(seed = "2026-06-11T00:00:00.000Z"): string {
  return new Date(seed).toISOString();
}

export function createSessionTimestamp(): string {
  return new Date().toISOString();
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
