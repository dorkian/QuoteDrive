import { useEffect, useState } from "react";

import { fetchCatalogueItems, type CatalogueItem } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";

interface PackageSpec {
  category: "electric_city" | "hybrid" | "long_distance";
  vehicleCount: number;
  services: string;
  assumptions: string;
  timeline: string;
}

const CANONICAL_CATEGORIES = [
  "electric_city",
  "hybrid",
  "long_distance",
] as const;

const PACKAGE_SPECS: Record<
  (typeof CANONICAL_CATEGORIES)[number],
  PackageSpec
> = {
  electric_city: {
    category: "electric_city",
    vehicleCount: 4,
    services:
      "Urban EV mobility bundle with standard telemetry & digital dispatch",
    assumptions: "Standard urban usage, 15,000 km/yr, central depot charging",
    timeline: "Delivery in 4–6 weeks",
  },
  hybrid: {
    category: "hybrid",
    vehicleCount: 5,
    services:
      "Regional fleet mobility with corporate fuel card & travel telematics",
    assumptions: "Mixed highway & city driving, 25,000 km/yr",
    timeline: "Delivery in 3–4 weeks",
  },
  long_distance: {
    category: "long_distance",
    vehicleCount: 3,
    services:
      "High-efficiency executive mobility with premium roadside network",
    assumptions: "High-mileage corridors, 40,000 km/yr, nationwide coverage",
    timeline: "Delivery in 6–8 weeks",
  },
};

function multiplyMoney(amount: string, quantity: number): string {
  const [whole, cents = "00"] = amount.split(".");
  const totalCents =
    (Number(whole) * 100 + Number(cents.padEnd(2, "0").slice(0, 2))) * quantity;
  const resultWhole = Math.trunc(totalCents / 100);
  const resultCents = Math.abs(totalCents % 100);
  return `${resultWhole}.${String(resultCents).padStart(2, "0")}`;
}

function LoadingSkeleton() {
  return (
    <div
      className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      role="status"
      aria-label="Package comparison loading"
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="animate-pulse rounded-lg border border-navy-800 bg-navy-900 p-5"
        >
          <div className="h-4 w-1/2 rounded bg-navy-700" />
          <div className="mt-4 h-8 w-2/3 rounded bg-navy-700" />
          <div className="mt-6 space-y-3">
            <div className="h-3 w-3/4 rounded bg-navy-700" />
            <div className="h-3 w-full rounded bg-navy-700" />
            <div className="h-3 w-5/6 rounded bg-navy-700" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PackageComparison() {
  const { token } = useAuth();
  const [catalogueItems, setCatalogueItems] = useState<CatalogueItem[] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }
    fetchCatalogueItems(token)
      .then((items) => setCatalogueItems(items))
      .catch(() =>
        setError("Couldn't load catalogue packages. Try refreshing the page."),
      );
  }, [token]);

  if (error) {
    return (
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-navy-50">
          Package comparison
        </h1>
        <p className="mt-1 text-sm text-navy-300">
          Compare three canonical fleet options side by side.
        </p>
        <p className="mt-4 text-sm text-red-400" role="alert">
          {error}
        </p>
      </div>
    );
  }

  if (catalogueItems === null) {
    return (
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-navy-50">
          Package comparison
        </h1>
        <p className="mt-1 text-sm text-navy-300">
          Compare three canonical fleet options side by side.
        </p>
        <LoadingSkeleton />
      </div>
    );
  }

  const activePackages = catalogueItems.filter(
    (item) => item.type === "package" && item.active,
  );
  const itemsByCategory = new Map(
    activePackages.map((item) => [item.category, item]),
  );
  const allThreePresent = CANONICAL_CATEGORIES.every((cat) =>
    itemsByCategory.has(cat),
  );

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-navy-50">
        Package comparison
      </h1>
      <p className="mt-1 text-sm text-navy-300">
        Compare three canonical fleet options side by side.
      </p>

      {!allThreePresent ? (
        <div className="mt-6 rounded-lg border border-navy-800 bg-navy-900 p-6 text-center">
          <p className="text-sm font-medium text-navy-50">
            Package comparison unavailable
          </p>
          <p className="mt-1 text-xs text-navy-300">
            Not all three packages are configured yet. The comparison requires
            Electric City, Hybrid Account Manager, and Long Distance packages
            active in the catalogue.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {CANONICAL_CATEGORIES.map((cat) => {
            const item = itemsByCategory.get(cat)!;
            const spec = PACKAGE_SPECS[cat];
            const lineTotal = multiplyMoney(
              item.base_monthly_estimate,
              spec.vehicleCount,
            );

            return (
              <section
                key={cat}
                className="flex flex-col justify-between rounded-lg border border-navy-800 bg-navy-900 p-5 transition-colors duration-150 hover:border-navy-700"
                aria-labelledby={`package-title-${cat}`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h2
                      id={`package-title-${cat}`}
                      className="text-base font-semibold text-navy-50"
                    >
                      {item.name}
                    </h2>
                    <span className="rounded-full bg-navy-800 px-2.5 py-0.5 text-xs font-medium text-lime-400">
                      {spec.vehicleCount} vehicles
                    </span>
                  </div>

                  <div className="mt-4 border-b border-navy-800 pb-4">
                    <p className="text-xs text-navy-400">Monthly estimate</p>
                    <p className="text-2xl font-bold tracking-tight text-navy-50">
                      ${lineTotal}
                      <span className="text-sm font-normal text-navy-300">
                        /mo
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-navy-400">
                      ${item.base_monthly_estimate}/mo per vehicle
                    </p>
                  </div>

                  <dl className="mt-4 flex flex-col gap-3">
                    <div>
                      <dt className="text-xs font-medium text-navy-300">
                        Services included
                      </dt>
                      <dd className="mt-0.5 text-xs text-navy-100">
                        {spec.services}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs font-medium text-navy-300">
                        Assumptions
                      </dt>
                      <dd className="mt-0.5 text-xs text-navy-100">
                        {spec.assumptions}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs font-medium text-navy-300">
                        Timeline
                      </dt>
                      <dd className="mt-0.5 text-xs text-navy-100">
                        {spec.timeline}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="mt-6 border-t border-navy-800 pt-3">
                  <p className="text-[11px] text-navy-400">
                    Illustrative planning estimate only.
                  </p>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
