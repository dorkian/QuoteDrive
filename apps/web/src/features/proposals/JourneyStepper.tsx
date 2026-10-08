import { Check, Minus } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ProposalVersion } from "../../lib/api";
import { JOURNEY_STEPS, currentStep } from "./journey";

const STEPS = JOURNEY_STEPS;

const HINTS: Record<number, string> = {
  0: "Pick packages and quantities. The monthly estimate is calculated for you.",
  1: "Next: use Draft with AI to write the narrative from your packages. You edit it before saving.",
  2: "Read and edit the narrative, then finalize to freeze this version.",
  3: "Finalized. Submit it for approval, or wait for the approver's decision.",
  4: "Approved. Open the client preview, then mark it as shared once it has gone out.",
};

function goTo(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

/** The proposal journey as five steps, so the AI-drafting step is visible from the first screen. */
export function JourneyStepper({ version }: { version: ProposalVersion }) {
  const current = currentStep(version);
  const hint = HINTS[current];

  return (
    <nav aria-label="Proposal progress" className="mt-4">
      <ol className="flex items-center gap-1 overflow-x-auto pb-1">
        {STEPS.map((step, i) => {
          const done = i < current;
          const active = i === current;
          const ai = "ai" in step && step.ai;
          // Finalized without an AI draft: the step was passed over, not completed.
          const skipped = ai && done && !version.narrative_json;
          const body = (
            <>
              <span
                aria-hidden="true"
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold",
                  done &&
                    !skipped &&
                    "border-teal-500/50 bg-teal-500/15 text-teal-300",
                  skipped && "border-border text-muted-foreground",
                  active &&
                    (ai
                      ? "border-cyan-400 bg-cyan-400/15 text-cyan-200"
                      : "border-primary bg-primary/15 text-primary"),
                  !done && !active && "border-border text-muted-foreground",
                )}
              >
                {skipped ? (
                  <Minus className="size-3.5" />
                ) : done ? (
                  <Check className="size-3.5" />
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={cn(
                  "whitespace-nowrap text-sm",
                  active
                    ? "font-medium text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {step.label}
                {skipped && <span className="sr-only"> (skipped)</span>}
              </span>
            </>
          );
          return (
            <li
              key={step.label}
              className="flex items-center gap-1"
              aria-current={active ? "step" : undefined}
            >
              {step.target ? (
                <button
                  type="button"
                  onClick={() => goTo(step.target)}
                  className="flex items-center gap-2 rounded-md px-2 py-1 transition-colors duration-150 hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {body}
                </button>
              ) : (
                <span className="flex items-center gap-2 px-2 py-1">
                  {body}
                </span>
              )}
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className="h-px w-4 shrink-0 bg-border sm:w-8"
                />
              )}
            </li>
          );
        })}
      </ol>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
    </nav>
  );
}
