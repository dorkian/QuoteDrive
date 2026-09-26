import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  ErrorState,
  LoadingRegion,
  Skeleton,
} from "../../components/states/StateViews";
import { fetchCatalogueItems, type CatalogueItem } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { describeError, type ErrorDescription } from "../../lib/errors";

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
    <LoadingRegion label="Package comparison loading">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-72 rounded-lg" />
        ))}
      </div>
    </LoadingRegion>
  );
}

function PageHeading() {
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight text-foreground">
        Package comparison
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Compare three canonical fleet options side by side.
      </p>
    </>
  );
}

export function PackageComparison() {
  const { token, me } = useAuth();
  const [catalogueItems, setCatalogueItems] = useState<CatalogueItem[] | null>(
    null,
  );
  const [error, setError] = useState<ErrorDescription | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!token) {
      return;
    }
    fetchCatalogueItems(token)
      .then((items) => setCatalogueItems(items))
      .catch((err: unknown) =>
        setError(
          describeError(err, {
            action: "load catalogue packages",
            role: me?.role,
          }),
        ),
      );
  }, [token, me?.role, attempt]);

  function retry(): void {
    setError(null);
    setCatalogueItems(null);
    setAttempt((n) => n + 1);
  }

  if (error) {
    return (
      <div>
        <PageHeading />
        <ErrorState
          message={error.message}
          onRetry={error.retryable ? retry : undefined}
        />
      </div>
    );
  }

  if (catalogueItems === null) {
    return (
      <div>
        <PageHeading />
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
      <PageHeading />

      {!allThreePresent ? (
        <div className="mt-6 rounded-lg border border-border bg-card p-6 text-center">
          <p className="text-sm font-medium text-foreground">
            Package comparison unavailable
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
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
                className="flex flex-col justify-between rounded-lg border border-border bg-card p-5 transition-colors duration-150 hover:border-navy-700"
                aria-labelledby={`package-title-${cat}`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h2
                      id={`package-title-${cat}`}
                      className="text-base font-semibold text-foreground"
                    >
                      {item.name}
                    </h2>
                    <Badge variant="outline">
                      {spec.vehicleCount} vehicles
                    </Badge>
                  </div>

                  <div className="mt-4 border-b border-border pb-4">
                    <p className="text-xs text-navy-400">Monthly estimate</p>
                    <p className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
                      ${lineTotal}
                      <span className="text-sm font-normal text-muted-foreground">
                        /mo
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-navy-400">
                      ${item.base_monthly_estimate}/mo per vehicle
                    </p>
                  </div>

                  <dl className="mt-4 flex flex-col gap-3">
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">
                        Services included
                      </dt>
                      <dd className="mt-0.5 text-xs text-foreground">
                        {spec.services}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">
                        Assumptions
                      </dt>
                      <dd className="mt-0.5 text-xs text-foreground">
                        {spec.assumptions}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">
                        Timeline
                      </dt>
                      <dd className="mt-0.5 text-xs text-foreground">
                        {spec.timeline}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="mt-6 border-t border-border pt-3">
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
