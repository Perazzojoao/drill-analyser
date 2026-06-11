import type { CanonicalParameter } from "./types";

export interface ParameterDefinition {
  canonicalName: CanonicalParameter;
  label: string;
  aliases: string[];
  role: "axis" | "parameter";
  defaultUnit?: string;
  units: string[];
  range?: { min: number; max: number; percentMax?: number };
}

export const PARAMETER_DEFINITIONS: Record<CanonicalParameter, ParameterDefinition> = {
  depth: {
    canonicalName: "depth",
    label: "Depth",
    aliases: ["depth", "dep", "measured depth", "md", "hole depth", "bit depth"],
    role: "axis",
    defaultUnit: "m",
    units: ["m", "meter", "meters", "ft", "feet"],
  },
  timestamp: {
    canonicalName: "timestamp",
    label: "Time",
    aliases: ["time", "timestamp", "date time", "datetime", "date"],
    role: "axis",
    units: ["utc", "local"],
  },
  rop: {
    canonicalName: "rop",
    label: "ROP",
    aliases: ["rop", "rop avg", "rop_avg", "rate of penetration", "avg rop"],
    role: "parameter",
    defaultUnit: "m/h",
    units: ["m/h", "m/hr", "ft/h", "ft/hr"],
    range: { min: 0, max: 300 },
  },
  wob: {
    canonicalName: "wob",
    label: "WOB",
    aliases: ["wob", "weight on bit"],
    role: "parameter",
    defaultUnit: "klbf",
    units: ["klbf", "k-lb", "ton", "tonne", "kn"],
    range: { min: 0, max: 100 },
  },
  rpm: {
    canonicalName: "rpm",
    label: "Surface RPM",
    aliases: ["rpm", "surf_rpm", "surf rpm", "surface rpm", "rotary rpm"],
    role: "parameter",
    defaultUnit: "rpm",
    units: ["rpm"],
    range: { min: 0, max: 350 },
  },
  phif: {
    canonicalName: "phif",
    label: "PHIF",
    aliases: ["phif", "porosity", "formation porosity"],
    role: "parameter",
    units: ["fraction", "%", "percent"],
    range: { min: 0, max: 1, percentMax: 100 },
  },
  vsh: {
    canonicalName: "vsh",
    label: "VSH",
    aliases: ["vsh", "volume shale", "volume of shale"],
    role: "parameter",
    units: ["fraction", "%", "percent"],
    range: { min: 0, max: 1, percentMax: 100 },
  },
  sw: {
    canonicalName: "sw",
    label: "SW",
    aliases: ["sw", "water saturation", "saturation water"],
    role: "parameter",
    units: ["fraction", "%", "percent"],
    range: { min: 0, max: 1, percentMax: 100 },
  },
  klogh: {
    canonicalName: "klogh",
    label: "KLOGH",
    aliases: ["klogh"],
    role: "parameter",
    units: [],
  },
  torque: {
    canonicalName: "torque",
    label: "Torque",
    aliases: ["torque", "tq", "rotary torque"],
    role: "parameter",
    units: ["kn.m", "ft-lb", "nm"],
    range: { min: 0, max: 100 },
  },
  spp: {
    canonicalName: "spp",
    label: "Standpipe Pressure",
    aliases: ["spp", "standpipe pressure", "stand pipe pressure"],
    role: "parameter",
    units: ["psi", "bar", "kpa"],
    range: { min: 0, max: 10000 },
  },
  flowRate: {
    canonicalName: "flowRate",
    label: "Flow Rate",
    aliases: ["flow rate", "flowrate", "flow_rate", "flow in", "mud flow"],
    role: "parameter",
    units: ["gpm", "lpm", "m3/min"],
    range: { min: 0, max: 2500 },
  },
};

export const REQUIRED_ROP_SCHEMA_HEADERS = [
  "Depth",
  "WOB",
  "SURF_RPM",
  "ROP AVG",
  "ROP_AVG",
  "PHIF",
  "VSH",
  "SW",
  "KLOGH",
] as const;

export const CHART_COLOR_TOKENS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

export function stripBom(value: string): string {
  return value.replace(/^\uFEFF/, "");
}

export function normalizeHeader(value: string): string {
  return stripBom(value)
    .trim()
    .replace(/[([]\s*[^\])]+?\s*[)\]]/g, " ")
    .replace(/[{}]/g, " ")
    .replace(/[\s-]+/g, " ")
    .toLowerCase();
}

export function extractUnitHint(header: string): string | undefined {
  const match = stripBom(header).match(/[([]\s*([^\])]+?)\s*[)\]]/);
  return match?.[1]?.trim();
}

export function isPercentUnit(unit?: string): boolean {
  return unit === "%" || unit?.toLowerCase() === "percent";
}

export function findParameterDefinition(header: string): ParameterDefinition | undefined {
  const normalized = normalizeHeader(header);
  const unit = extractUnitHint(header)?.toLowerCase();

  return Object.values(PARAMETER_DEFINITIONS).find((definition) => {
    const aliasMatch = definition.aliases.some((alias) => normalizeHeader(alias) === normalized);
    const unitMatch = unit ? definition.units.some((candidate) => candidate.toLowerCase() === unit) : false;
    return aliasMatch || unitMatch;
  });
}
