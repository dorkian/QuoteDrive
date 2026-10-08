import {
  ArrowRight,
  Hourglass,
  PartyPopper,
  Plus,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { ActivityTimeline } from "@/components/ActivityTimeline";
import { Avatar } from "@/components/Avatar";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { EmptyState } from "../../components/states/StateViews";
import { formatRelativeTime } from "../../components/activity-timeline-utils";
import type { Opportunity, ProposalVersion } from "../../lib/api";
import { formatMoney } from "../dashboard/charts/chart-theme";
import { DiscoveryBriefPanel } from "./DiscoveryBriefPanel";
import { nextStep, type NextStepAction } from "./next-step";

const AI_BUTTON =
  "border-cyan-400/40 bg-cyan-400/10 text-info-foreground hover:bg-cyan-400/20";

function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-foreground">
        {children}
      </dd>
    </div>
  );
}

/**
 * Everything about one opportunity: what to do next, the key facts, and the
 * brief, proposals and activity in tabs. Used by the side panel and the full page.
 */
export function OpportunityBody({
  token,
  opportunity,
  versions,
  editable,
  creating,
  activityKey,
  onAction,
  onSaved,
}: {
  token: string;
  opportunity: Opportunity;
  versions: ProposalVersion[];
  editable: boolean;
  creating: boolean;
  activityKey: number;
  onAction: (action: Exclude<NextStepAction, { kind: "brief" }>) => void;
  onSaved: (opportunity: Opportunity) => void;
}) {
  const [tab, setTab] = useState("overview");
  const step = nextStep(opportunity, versions, editable);
  const latest = [...versions].sort(
    (a, b) => b.version_number - a.version_number,
  )[0];

  function runCta(action: NextStepAction): void {
    if (action.kind === "brief") {
      setTab("overview");
      // Let the tab render, then land the cursor where the notes go.
      requestAnimationFrame(() =>
        document.getElementById("discovery-notes")?.focus(),
      );
      return;
    }
    onAction(action);
  }

  const Icon =
    step.tone === "done"
      ? PartyPopper
      : step.tone === "waiting"
        ? Hourglass
        : Sparkles;

  return (
    <div className="space-y-5">
      <section
        aria-label="Next step"
        className={cn(
          "rounded-lg border p-4",
          step.tone === "action" && "border-primary/30 bg-primary/5",
          step.tone === "waiting" && "border-amber-400/30 bg-amber-400/5",
          step.tone === "done" && "border-border bg-card",
        )}
      >
        <div className="flex items-start gap-3">
          <Icon
            aria-hidden="true"
            className={cn(
              "mt-0.5 size-5 shrink-0",
              step.tone === "action" && "text-primary",
              step.tone === "waiting" && "text-warning-foreground",
              step.tone === "done" && "text-muted-foreground",
            )}
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">
              Next step
            </p>
            <h3 className="mt-0.5 text-base font-semibold text-foreground">
              {step.title}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
            {step.cta && (
              <Button
                className={cn("mt-3", step.cta.ai && AI_BUTTON)}
                variant={step.cta.ai ? "outline" : "default"}
                onClick={() => runCta(step.cta!.action)}
                disabled={creating && step.cta.action.kind === "create-draft"}
              >
                {step.cta.ai ? <Sparkles aria-hidden="true" /> : null}
                {creating && step.cta.action.kind === "create-draft"
                  ? "Creating…"
                  : step.cta.label}
                {!step.cta.ai && <ArrowRight aria-hidden="true" />}
              </Button>
            )}
          </div>
        </div>
      </section>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <Fact label="Monthly estimate">
          {latest ? (
            <span className="tabular-nums">
              {formatMoney(Number(latest.total_estimate))}
            </span>
          ) : (
            <span className="font-normal text-muted-foreground">
              No proposal yet
            </span>
          )}
        </Fact>
        <Fact label="Proposals">{versions.length}</Fact>
        <Fact label="Owner">
          <span className="inline-flex items-center gap-1.5">
            {opportunity.owner_name && (
              <Avatar name={opportunity.owner_name} size="sm" />
            )}
            {opportunity.owner_name ?? "Unassigned"}
          </span>
        </Fact>
        <Fact label="Last activity">
          {opportunity.last_activity_at
            ? formatRelativeTime(opportunity.last_activity_at)
            : "None yet"}
        </Fact>
      </dl>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="proposals">
            Proposals ({versions.length})
          </TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <DiscoveryBriefPanel
            token={token}
            opportunity={opportunity}
            editable={editable}
            onSaved={onSaved}
            embedded
          />
        </TabsContent>

        <TabsContent value="proposals" className="mt-4">
          {versions.length === 0 ? (
            <EmptyState
              message="No proposal versions yet. Create the first one to pick packages and let AI draft the narrative."
              action={
                editable ? (
                  <Button
                    size="sm"
                    onClick={() => onAction({ kind: "create-draft" })}
                    disabled={creating}
                  >
                    <Plus aria-hidden="true" />
                    Create draft version
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {[...versions]
                .sort((a, b) => b.version_number - a.version_number)
                .map((version) => (
                  <li key={version.id}>
                    <Link
                      to={`/opportunities/${opportunity.id}/versions/${version.id}`}
                      className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-4 py-3 transition-colors duration-150 hover:border-navy-700 hover:bg-navy-800/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      <span className="text-sm font-medium text-foreground">
                        Version {version.version_number}
                      </span>
                      <span className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
                        <span className="text-xs text-muted-foreground tabular-nums">
                          ${version.total_estimate}
                        </span>
                        <StatusBadge status={version.status} />
                        <ArrowRight
                          aria-hidden="true"
                          className="size-4 text-muted-foreground"
                        />
                      </span>
                    </Link>
                  </li>
                ))}
            </ul>
          )}
          {editable && versions.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => onAction({ kind: "create-draft" })}
              disabled={creating}
            >
              <Plus aria-hidden="true" />
              {creating ? "Creating…" : "New draft version"}
            </Button>
          )}
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <ActivityTimeline
            key={activityKey}
            entityType="opportunity"
            entityId={opportunity.id}
            emptyMessage="No activity on this opportunity yet."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
