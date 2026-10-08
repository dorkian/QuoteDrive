import { cn } from "@/lib/utils";

const TINTS = [
  "#3987e5",
  "#d95926",
  "#199e70",
  "#c98500",
  "#9085e9",
  "#e87ba4",
];

/** Drawn marks for the fictional demo customers (public/logos, made by scripts/make_logos.py). */
const DRAWN_LOGOS = new Set([
  "alder-health-network",
  "brightwater-utilities",
  "cedar-pine-logistics",
  "fernhill-council-services",
  "harbor-freight-cooperative",
  "kestrel-biotech-campus",
  "lombarda-studio-group",
  "meridian-law-partners",
  "northgate-university",
  "orchard-retail-collective",
  "peregrine-outdoor-co",
  "quarry-co",
  "skyline-aviation-services",
  "solace-hospitality-group",
  "tidewater-insurance-services",
  "vantage-media-studios",
]);

function logoSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function hashOf(name: string): number {
  let hash = 7;
  for (const ch of name.toLowerCase())
    hash = (hash * 33 + ch.charCodeAt(0)) >>> 0;
  return hash;
}

function initials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  const first = words[0]?.[0] ?? "?";
  const second = words.length > 1 ? words[1][0] : (words[0]?.[1] ?? "");
  return (first + second).toUpperCase();
}

/** One of four quiet geometric marks, chosen by the name, drawn in the tint. */
function Motif({ kind, tint }: { kind: number; tint: string }) {
  const common = {
    fill: "none",
    stroke: tint,
    strokeWidth: 6,
    opacity: 0.35,
  } as const;
  return (
    <svg
      viewBox="0 0 100 100"
      className="absolute inset-0 size-full"
      aria-hidden="true"
    >
      {kind === 0 && (
        <>
          <circle cx="78" cy="22" r="34" {...common} />
          <circle cx="78" cy="22" r="18" {...common} />
        </>
      )}
      {kind === 1 && (
        <>
          <path d="M-5 70 L70 -5" {...common} />
          <path d="M5 105 L105 5" {...common} />
        </>
      )}
      {kind === 2 && (
        <>
          <rect
            x="62"
            y="-8"
            width="46"
            height="46"
            rx="10"
            {...common}
            transform="rotate(18 85 15)"
          />
          <rect x="-12" y="70" width="40" height="40" rx="8" {...common} />
        </>
      )}
      {kind === 3 && (
        <>
          {[0, 1, 2].flatMap((row) =>
            [0, 1, 2].map((col) => (
              <circle
                key={`${row}${col}`}
                cx={58 + col * 16}
                cy={14 + row * 16}
                r="3.2"
                fill={tint}
                opacity={0.4}
              />
            )),
          )}
        </>
      )}
    </svg>
  );
}

const SIZES = {
  sm: "size-7 rounded-md text-[10px]",
  md: "size-9 rounded-lg text-xs",
  lg: "size-12 rounded-xl text-sm",
  xl: "size-16 rounded-2xl text-xl",
} as const;

/**
 * A generated logo mark for a company: initials on a tinted tile with one of a few
 * geometric motifs. Stable per name, no image to load, and never a real brand, which
 * keeps the demo inside the synthetic-data policy. Decorative: the name sits beside it.
 */
export function CompanyLogo({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const hash = hashOf(name);
  const tint = TINTS[hash % TINTS.length];
  const slug = logoSlug(name);
  if (DRAWN_LOGOS.has(slug)) {
    return (
      <img
        src={`${import.meta.env.BASE_URL}logos/${slug}.svg`}
        alt=""
        aria-hidden="true"
        data-logo="drawn"
        className={cn("shrink-0 select-none", SIZES[size], className)}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      data-logo={tint}
      style={{
        background: `linear-gradient(145deg, color-mix(in oklab, ${tint} 28%, var(--color-card)), color-mix(in oklab, ${tint} 10%, var(--color-card)))`,
        borderColor: `color-mix(in oklab, ${tint} 45%, transparent)`,
        color: `color-mix(in oklab, ${tint} 55%, white)`,
      }}
      className={cn(
        "relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden border font-bold tracking-tight",
        SIZES[size],
        className,
      )}
    >
      <Motif kind={Math.floor(hash / 7) % 4} tint={tint} />
      <span className="relative">{initials(name)}</span>
    </span>
  );
}
