/**
 * Chart colours: the dataviz reference palette's dark categorical slots, in
 * order (validated on the navy-900 card surface), plus its fixed status
 * colours. Status colours always ship with an icon and a label.
 */
export const SERIES = {
  blue: "#3987e5",
  orange: "#d95926",
  aqua: "#199e70",
  yellow: "#c98500",
} as const;

export const STATUS = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
} as const;

export const INK = {
  primary: "var(--color-foreground)",
  secondary: "var(--color-muted-foreground)",
  muted: "var(--color-navy-400)",
  grid: "var(--color-navy-800)",
  surface: "var(--color-card)",
  focus: "var(--color-lime-400)",
} as const;

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const compactMoney = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

export const formatMoney = (value: number): string => money.format(value);
export const formatCompactMoney = (value: number): string =>
  compactMoney.format(value);

export function formatWeek(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48)
    return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} d`;
}

export function formatLatency(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`;
}

/** A round axis maximum and evenly spaced ticks from 0. */
export function niceScale(
  max: number,
  tickCount = 4,
): { max: number; ticks: number[] } {
  if (max <= 0) return { max: 1, ticks: [0, 1] };
  const rough = max / tickCount;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step =
    [1, 2, 2.5, 5, 10].map((f) => f * pow).find((s) => s >= rough) ?? pow * 10;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step)
    ticks.push(Math.round(v * 100) / 100);
  return { max: top, ticks };
}
