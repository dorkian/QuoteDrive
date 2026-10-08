import type { CompanySize, Customer } from "./api";

export const COMPANY_SIZE_OPTIONS: {
  value: CompanySize;
  label: string;
  short: string;
}[] = [
  { value: "1-50", label: "Small team (1-50 employees)", short: "1-50 people" },
  {
    value: "51-200",
    label: "Growing company (51-200 employees)",
    short: "51-200 people",
  },
  {
    value: "201-1000",
    label: "Mid-size company (201-1000 employees)",
    short: "201-1000 people",
  },
  {
    value: "1000+",
    label: "Large enterprise (1000+ employees)",
    short: "1000+ people",
  },
];

export function companySizeShort(
  size: string | null | undefined,
): string | null {
  return COMPANY_SIZE_OPTIONS.find((o) => o.value === size)?.short ?? null;
}

/** "https://www.acme.example/path" -> "acme.example", for showing a link compactly. */
export function websiteDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Only web links are ever rendered as links. */
export function safeWebsite(url: string | null | undefined): string | null {
  return url && /^https?:\/\//i.test(url) ? url : null;
}

export function headquarters(
  customer: Pick<Customer, "hq_city" | "hq_country">,
): string | null {
  const place = [customer.hq_city, customer.hq_country]
    .filter(Boolean)
    .join(", ");
  return place || null;
}
