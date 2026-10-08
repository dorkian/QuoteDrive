import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { fetchAuditEvents, type AuditEvent } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { describeError, type ErrorDescription } from "../lib/errors";
import { EmptyState, ErrorState } from "./states/StateViews";
import { describeEvent, formatRelativeTime } from "./activity-timeline-utils";

export interface ActivityTimelineProps {
  entityType?: string;
  entityId?: number;
  emptyMessage?: string;
  limit?: number;
  /**
   * Keep the timeline inside a fixed-height panel that scrolls on its own
   * (hidden scrollbar, soft fade at the edges) instead of growing the page
   * when more events are loaded.
   */
  contained?: boolean;
}

const FADE = "1.5rem";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function TimelineSkeleton() {
  return (
    <div
      className="space-y-4 py-2"
      role="status"
      aria-label="Activity timeline loading"
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex animate-pulse items-center gap-3 motion-reduce:animate-none"
        >
          <div className="h-2 w-2 rounded-full bg-navy-700" />
          <div className="h-4 w-52 rounded bg-navy-800" />
        </div>
      ))}
    </div>
  );
}

export function ActivityTimeline({
  entityType,
  entityId,
  emptyMessage = "No activity yet.",
  limit = 20,
  contained = false,
}: ActivityTimelineProps) {
  const { token, me } = useAuth();
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  // A failed first load replaces the timeline; a failed "Load more" is shown
  // above the events already loaded.
  const [loadError, setLoadError] = useState<ErrorDescription | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Contained mode: which edges still have content beyond them, and which
  // freshly loaded event to scroll to once it has rendered.
  const panelRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ top: false, bottom: false });
  const [revealId, setRevealId] = useState<number | null>(null);

  // Fetch one extra row so we can tell "exactly `limit` events, no more" apart
  // from "more than `limit` events exist" without a second round-trip — the
  // API caps `limit` at 100, so this can't push the request past that ceiling.
  const fetchLimit = Math.min(limit + 1, 100);

  // Bumped whenever the query identity changes (below). Both the fetch effect
  // and handleLoadMore check this after their request resolves, so a stale
  // response from a superseded entityType/entityId (e.g. the user navigated
  // to a different proposal version mid-request) is discarded instead of
  // being spliced into the new query's results.
  const requestIdRef = useRef(0);

  // Reset during render (not in an effect — see ApprovalDetail.tsx's prevId
  // convention) so the stale-data flash and an extra effect commit are both
  // avoided; comparing the individual values directly rather than a
  // synthesized string key.
  const [prevQuery, setPrevQuery] = useState({
    token,
    entityType,
    entityId,
    limit,
  });
  if (
    prevQuery.token !== token ||
    prevQuery.entityType !== entityType ||
    prevQuery.entityId !== entityId ||
    prevQuery.limit !== limit
  ) {
    setPrevQuery({ token, entityType, entityId, limit });
    setEvents(null);
    setLoadError(null);
    setError(null);
    setHasMore(false);
  }

  useEffect(() => {
    // Bumped here (an effect, not render) so mutating the ref stays outside
    // render; this still runs once per query-identity change, in step with
    // the render-phase reset above since both share the same dependencies.
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    if (!token) {
      return;
    }

    fetchAuditEvents(token, { limit: fetchLimit, entityType, entityId })
      .then((fetched) => {
        if (requestIdRef.current !== requestId) {
          return;
        }
        const more = fetched.length > limit;
        setEvents(more ? fetched.slice(0, limit) : fetched);
        setHasMore(more);
      })
      .catch((err: unknown) => {
        if (requestIdRef.current !== requestId) {
          return;
        }
        setLoadError(
          describeError(err, { action: "load activity", role: me?.role }),
        );
      });
  }, [token, me?.role, entityType, entityId, limit, fetchLimit, attempt]);

  function retry(): void {
    setLoadError(null);
    setEvents(null);
    setAttempt((n) => n + 1);
  }

  const handleLoadMore = async () => {
    if (!token || !events || events.length === 0 || loadingMore) {
      return;
    }
    const requestId = requestIdRef.current;
    const lastEvent = events[events.length - 1];
    setLoadingMore(true);
    setError(null);
    try {
      const nextEvents = await fetchAuditEvents(token, {
        limit: fetchLimit,
        entityType,
        entityId,
        beforeId: lastEvent.id,
      });
      if (requestIdRef.current !== requestId) {
        return;
      }
      const more = nextEvents.length > limit;
      const page = more ? nextEvents.slice(0, limit) : nextEvents;
      setEvents((prev) => [...(prev ?? []), ...page]);
      setHasMore(more);
      if (contained && page.length > 0) setRevealId(page[0].id);
    } catch {
      if (requestIdRef.current === requestId) {
        setError("Couldn't load more activity.");
      }
    } finally {
      if (requestIdRef.current === requestId) {
        setLoadingMore(false);
      }
    }
  };

  function updateEdges(): void {
    const el = panelRef.current;
    if (!el) return;
    const top = el.scrollTop > 1;
    const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    setEdges((prev) =>
      prev.top === top && prev.bottom === bottom ? prev : { top, bottom },
    );
  }

  // After "Load more": glide the panel to the first new event (never the page).
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (revealId === null || !panel) return;
    const target = panel.querySelector<HTMLElement>(
      `[data-event-id="${revealId}"]`,
    );
    if (target && typeof panel.scrollTo === "function") {
      const offset =
        target.getBoundingClientRect().top -
        panel.getBoundingClientRect().top +
        panel.scrollTop;
      panel.scrollTo({
        top: Math.max(offset - 8, 0),
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    }
    setRevealId(null);
  }, [revealId]);

  // Keep the fade edges in step with the content as it loads.
  useLayoutEffect(() => {
    if (contained) updateEdges();
  }, [contained, events, hasMore, loadingMore]);

  if (loadError) {
    return (
      <ErrorState
        className=""
        message={loadError.message}
        onRetry={loadError.retryable ? retry : undefined}
      />
    );
  }

  if (events === null) {
    return <TimelineSkeleton />;
  }

  if (events.length === 0) {
    return <EmptyState className="" message={emptyMessage} />;
  }

  const fadeTop = edges.top ? "transparent 0" : "#000 0";
  const fadeBottom = edges.bottom ? "transparent 100%" : "#000 100%";
  const mask = `linear-gradient(to bottom, ${fadeTop}, #000 ${FADE}, #000 calc(100% - ${FADE}), ${fadeBottom})`;

  const body = (
    <div className="space-y-4">
      {error && (
        <p className="text-sm text-destructive-foreground" role="alert">
          {error}
        </p>
      )}
      <ol className="relative ml-2 border-l border-border space-y-6">
        {events.map((event) => {
          const { actionDescription, entityReference } = describeEvent(event);
          return (
            <li
              key={event.id}
              data-event-id={event.id}
              className="relative pl-6"
            >
              <span
                className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-navy-400 ring-4 ring-card"
                aria-hidden="true"
              />
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                <p className="min-w-0 text-sm text-foreground">
                  <span className="font-medium text-foreground">
                    {event.actor_name}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    {actionDescription}
                  </span>{" "}
                  <span className="font-medium text-foreground">
                    {entityReference}
                  </span>
                </p>
                <time
                  dateTime={event.created_at}
                  title={new Date(event.created_at).toLocaleString()}
                  className="text-xs text-navy-400 whitespace-nowrap"
                >
                  {formatRelativeTime(event.created_at)}
                </time>
              </div>
            </li>
          );
        })}
      </ol>
      {hasMore && (
        <div className="pl-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleLoadMore()}
            disabled={loadingMore}
          >
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );

  if (!contained) return body;

  // Hidden scrollbar: keyboard users still reach the panel (tabIndex), and the
  // edge fades tell everyone there is more above or below.
  return (
    <div
      ref={panelRef}
      role="region"
      aria-label="Activity list"
      tabIndex={0}
      onScroll={updateEdges}
      className="max-h-[26rem] overflow-y-auto scroll-smooth py-1 [scrollbar-width:none] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:scroll-auto [&::-webkit-scrollbar]:hidden"
      style={{ maskImage: mask, WebkitMaskImage: mask }}
    >
      {body}
    </div>
  );
}
