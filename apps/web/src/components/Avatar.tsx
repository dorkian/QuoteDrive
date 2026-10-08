import { cn } from "@/lib/utils";

const TINTS = [
  "#3987e5",
  "#d95926",
  "#199e70",
  "#c98500",
  "#9085e9",
  "#e87ba4",
];

function initials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s&]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  const first = words[0]?.[0] ?? "?";
  const second = words.length > 1 ? words[1][0] : (words[0]?.[1] ?? "");
  return (first + second).toUpperCase();
}

function tintFor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return TINTS[hash % TINTS.length];
}

/** Initials in a tinted circle; the tint is stable per name. Decorative by default. */
export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const tint = tintFor(name);
  return (
    <span
      aria-hidden="true"
      style={{
        background: `color-mix(in oklab, ${tint} 22%, transparent)`,
        color: `color-mix(in oklab, ${tint} 60%, white)`,
        borderColor: `color-mix(in oklab, ${tint} 38%, transparent)`,
      }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border font-semibold",
        size === "sm" && "size-6 text-[10px]",
        size === "md" && "size-8 text-xs",
        size === "lg" && "size-11 text-sm",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
