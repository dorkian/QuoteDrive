import { useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";

import {
  fetchCustomer,
  fetchOpportunity,
  fetchProposalVersion,
  isPreviewableStatus,
  type Customer,
  type Opportunity,
  type ProposalVersion,
  type ProposalVersionStatus,
} from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { describeError } from "../../../lib/errors";
import { LoginScreen } from "../../auth/LoginScreen";

const PRINT_PAGE_CSS = "@page { size: A4; margin: 18mm 16mm; }";

// Screen colors come from the navy system; print swaps to ink on white paper.
const INK = "text-navy-50 print:text-black";
const MUTED = "text-navy-300 print:text-neutral-600";
const RULE = "border-navy-800 print:border-neutral-300";
const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-400";

const STATUS_LABELS: Record<ProposalVersionStatus, string> = {
  draft: "Draft",
  configured: "Configured",
  proposal_drafted: "Proposal drafted",
  awaiting_approval: "Awaiting approval",
  approved: "Approved",
  shared: "Shared",
  won: "Won",
  lost: "Lost",
  expired: "Expired",
  changes_requested: "Changes requested",
};

type LoadState =
  | {
      kind: "loaded";
      versionId: number;
      version: ProposalVersion;
      opportunity: Opportunity;
      customer: Customer;
    }
  | { kind: "error"; versionId: number; retryable: boolean };

// Formats the API's decimal strings without a float round-trip.
function formatAmount(value: string): string {
  const [whole, fraction = ""] = value.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `$${grouped}.${fraction.padEnd(2, "0").slice(0, 2)}`;
}

export function ProposalPreviewPage() {
  const { status, me, token } = useAuth();
  const { versionId } = useParams<{ versionId: string }>();
  const id = Number(versionId);
  const isInvalidId = !Number.isInteger(id) || id <= 0;
  const [state, setState] = useState<LoadState | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!token || isInvalidId) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const version = await fetchProposalVersion(token, id);
        const opportunity = await fetchOpportunity(
          token,
          version.opportunity_id,
        );
        const customer = await fetchCustomer(token, opportunity.customer_id);
        if (!cancelled) {
          setState({
            kind: "loaded",
            versionId: id,
            version,
            opportunity,
            customer,
          });
        }
      } catch (err) {
        if (!cancelled) {
          const { retryable } = describeError(err, {
            action: "load this proposal",
          });
          setState({ kind: "error", versionId: id, retryable });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, id, isInvalidId, attempt]);

  function retry(): void {
    setState(null);
    setAttempt((n) => n + 1);
  }

  if (status === "unauthenticated" || (status === "authenticated" && !me)) {
    return <LoginScreen />;
  }

  // Ignore a result that belongs to a previous :versionId.
  const current = state?.versionId === id ? state : null;

  if (isInvalidId || current?.kind === "error") {
    return (
      <PreviewShell>
        <LoadError
          onRetry={
            current?.kind === "error" && current.retryable ? retry : undefined
          }
        />
      </PreviewShell>
    );
  }

  if (status === "loading" || !me || !current) {
    return (
      <PreviewShell>
        <DocumentSkeleton />
      </PreviewShell>
    );
  }

  const { version, opportunity, customer } = current;
  const builderPath = `/opportunities/${version.opportunity_id}/versions/${version.id}`;

  if (!isPreviewableStatus(version.status)) {
    return (
      <PreviewShell>
        <NotApproved
          version={version}
          opportunity={opportunity}
          builderPath={builderPath}
        />
      </PreviewShell>
    );
  }

  return (
    <PreviewShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 print:hidden">
        <Link
          to={builderPath}
          className={`-ml-2 rounded-md px-2 py-1.5 text-sm text-navy-300 transition-colors duration-150 hover:text-lime-400 ${FOCUS}`}
        >
          ← Back to version {version.version_number}
        </Link>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="text-sm text-navy-300">
            Client preview · {STATUS_LABELS[version.status]}
          </p>
          <button
            type="button"
            onClick={() => window.print()}
            className={`rounded-md bg-lime-400 px-4 py-2 text-sm font-medium text-navy-950 transition-colors duration-150 hover:bg-lime-300 ${FOCUS}`}
          >
            Print or save as PDF
          </button>
        </div>
      </div>

      <ProposalDocument
        organizationName={me.organization.name}
        version={version}
        opportunity={opportunity}
        customer={customer}
      />
    </PreviewShell>
  );
}

function PreviewShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-navy-950 px-4 py-8 text-navy-50 sm:px-6 sm:py-10 print:min-h-0 print:bg-white print:p-0 print:text-black">
      <style>{PRINT_PAGE_CSS}</style>
      <div className="mx-auto max-w-[52rem]">{children}</div>
    </main>
  );
}

function ProposalDocument({
  organizationName,
  version,
  opportunity,
  customer,
}: {
  organizationName: string;
  version: ProposalVersion;
  opportunity: Opportunity;
  customer: Customer;
}) {
  const narrative = version.narrative_json;
  const lines = version.content_json.lines;

  return (
    <article className="rounded-lg border border-navy-800 bg-navy-900 px-6 py-8 sm:px-10 sm:py-10 print:rounded-none print:border-0 print:bg-transparent print:p-0">
      <header className={`border-b pb-6 ${RULE}`}>
        <p className={`text-sm ${MUTED}`}>
          {organizationName} · Proposal for {customer.name}
        </p>
        <h1
          className={`mt-2 text-2xl font-semibold tracking-tight text-balance sm:text-3xl ${INK}`}
        >
          {opportunity.title}
        </h1>
        <p className={`mt-3 text-sm ${MUTED}`}>
          Version {version.version_number}
        </p>
      </header>

      {!narrative && (
        <p className="mt-8 rounded-md border border-navy-700 px-4 py-3 text-sm text-navy-300 print:hidden">
          No narrative was saved for this version, so the client copy shows
          pricing only. Narratives are drafted and edited on the version before
          it's finalized.
        </p>
      )}

      {narrative && (
        <>
          <Section title="Executive summary">
            <Prose text={narrative.executive_summary} />
          </Section>
          <Section title="Recommended approach">
            <Prose text={narrative.recommended_approach} />
          </Section>
          <Section title="Scope">
            <Prose text={narrative.scope} />
          </Section>
        </>
      )}

      <Section title="Proposed packages">
        <PackageTable lines={lines} totalEstimate={version.total_estimate} />
      </Section>

      {narrative && narrative.assumptions_exclusions.length > 0 && (
        <Section title="Assumptions and exclusions">
          <ul
            className={`list-disc space-y-2 pl-5 text-[0.9375rem] leading-7 marker:text-navy-400 ${INK}`}
          >
            {narrative.assumptions_exclusions.map((item, index) => (
              <li key={index} className="max-w-prose text-pretty">
                {item}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {narrative && narrative.next_steps.length > 0 && (
        <Section title="Next steps">
          <ol
            className={`list-decimal space-y-2 pl-5 text-[0.9375rem] leading-7 marker:text-navy-400 ${INK}`}
          >
            {narrative.next_steps.map((item, index) => (
              <li key={index} className="max-w-prose text-pretty">
                {item}
              </li>
            ))}
          </ol>
        </Section>
      )}
    </article>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className={`text-base font-semibold print:break-after-avoid ${INK}`}>
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Prose({ text }: { text: string }) {
  return (
    <p
      className={`max-w-prose text-[0.9375rem] leading-7 whitespace-pre-line text-pretty ${INK}`}
    >
      {text}
    </p>
  );
}

function PackageTable({
  lines,
  totalEstimate,
}: {
  lines: ProposalVersion["content_json"]["lines"];
  totalEstimate: string;
}) {
  // In print, keep the total and its disclaimer on the same page: a total on its
  // own sheet reads as a binding figure.
  return (
    <div className="print:break-inside-avoid">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            Proposed packages with illustrative monthly estimates
          </caption>
          <thead>
            <tr className={`border-b text-left ${RULE} ${MUTED}`}>
              <th scope="col" className="py-2 pr-2 font-medium sm:pr-4">
                Package
              </th>
              <th
                scope="col"
                className="px-2 py-2 text-right font-medium sm:px-4"
              >
                Qty
              </th>
              <th
                scope="col"
                className="px-2 py-2 text-right font-medium sm:px-4"
              >
                Monthly per unit
              </th>
              <th
                scope="col"
                className="py-2 pl-2 text-right font-medium sm:pl-4"
              >
                Monthly total
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr
                key={index}
                className={`border-b align-top print:break-inside-avoid ${RULE}`}
              >
                <th
                  scope="row"
                  className="py-3 pr-2 text-left font-normal sm:pr-4"
                >
                  <span className={`font-medium ${INK}`}>{line.name}</span>
                  {line.assumptions && (
                    <span className={`mt-0.5 block text-xs ${MUTED}`}>
                      {line.assumptions}
                    </span>
                  )}
                </th>
                <td
                  className={`px-2 py-3 text-right tabular-nums sm:px-4 ${INK}`}
                >
                  {line.quantity}
                </td>
                <td
                  className={`px-2 py-3 text-right tabular-nums sm:px-4 ${INK}`}
                >
                  {formatAmount(line.unit_estimate)}
                </td>
                <td
                  className={`py-3 pl-2 text-right tabular-nums sm:pl-4 ${INK}`}
                >
                  {formatAmount(line.line_total)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th
                scope="row"
                colSpan={3}
                className={`pt-4 pr-2 text-right font-medium sm:pr-4 ${MUTED}`}
              >
                Estimated monthly total
              </th>
              <td
                className={`pt-4 pl-2 text-right text-base font-semibold tabular-nums sm:pl-4 ${INK}`}
              >
                {formatAmount(totalEstimate)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p
        className={`mt-4 text-right text-xs print:break-before-avoid ${MUTED}`}
      >
        Illustrative planning estimate only. Figures are indicative and are not
        a binding quote or commercial offer.
      </p>
    </div>
  );
}

function NotApproved({
  version,
  opportunity,
  builderPath,
}: {
  version: ProposalVersion;
  opportunity: Opportunity;
  builderPath: string;
}) {
  return (
    <div className="rounded-lg border border-navy-800 bg-navy-900 px-6 py-10 sm:px-10">
      <h1 className="text-lg font-semibold text-balance text-navy-50">
        Version {version.version_number} isn't approved yet
      </h1>
      <p className="mt-2 max-w-prose text-sm leading-6 text-navy-300">
        Client previews open once a version is approved, so customers only see
        reviewed content. This version of {opportunity.title} is currently{" "}
        <strong className="font-medium text-navy-50">
          {STATUS_LABELS[version.status].toLowerCase()}
        </strong>
        .
      </p>
      <Link
        to={builderPath}
        className={`mt-6 inline-block rounded-md border border-navy-700 px-4 py-2 text-sm font-medium text-navy-50 transition-colors duration-150 hover:border-lime-400 ${FOCUS}`}
      >
        Back to version {version.version_number}
      </Link>
    </div>
  );
}

// With onRetry the failure was transient (server/network); without it the
// proposal is missing or belongs to another workspace.
function LoadError({ onRetry }: { onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-navy-800 bg-navy-900 px-6 py-10 sm:px-10"
    >
      <h1 className="text-lg font-semibold text-navy-50">
        This proposal couldn't be loaded
      </h1>
      <p className="mt-2 max-w-prose text-sm leading-6 text-navy-300">
        {onRetry
          ? "The server didn't respond as expected. Try again in a moment."
          : "It may not exist, or it may belong to a different workspace. Check the link, or open the proposal from its opportunity."}
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className={`min-h-10 rounded-md bg-lime-400 px-4 py-2 text-sm font-medium text-navy-950 transition-colors duration-150 hover:bg-lime-300 ${FOCUS}`}
          >
            Try again
          </button>
        )}
        <Link
          to="/opportunities"
          className={`inline-flex min-h-10 items-center rounded-md border border-navy-700 px-4 py-2 text-sm font-medium text-navy-50 transition-colors duration-150 hover:border-lime-400 ${FOCUS}`}
        >
          Go to opportunities
        </Link>
      </div>
    </div>
  );
}

function DocumentSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading proposal preview"
      className="rounded-lg border border-navy-800 bg-navy-900 px-6 py-8 sm:px-10 sm:py-10"
    >
      <div className="h-4 w-56 animate-pulse rounded bg-navy-800 motion-reduce:animate-none" />
      <div className="mt-3 h-8 w-3/4 animate-pulse rounded bg-navy-800 motion-reduce:animate-none" />
      <div className="mt-12 space-y-3">
        <div className="h-4 w-40 animate-pulse rounded bg-navy-800 motion-reduce:animate-none" />
        <div className="h-4 w-full animate-pulse rounded bg-navy-800 motion-reduce:animate-none" />
        <div className="h-4 w-11/12 animate-pulse rounded bg-navy-800 motion-reduce:animate-none" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-navy-800 motion-reduce:animate-none" />
      </div>
    </div>
  );
}
