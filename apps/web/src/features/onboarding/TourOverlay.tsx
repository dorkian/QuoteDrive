import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TourStep } from "./tour-steps";

const GAP = 14;
const MARGIN = 12;
const PAD = 6;

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

function findTarget(name: string | undefined): HTMLElement | null {
  return name
    ? document.querySelector<HTMLElement>(`[data-tour="${name}"]`)
    : null;
}

/** Where the card goes: beside a sidebar item, otherwise below the target, otherwise above. */
function place(
  box: Box | null,
  card: { w: number; h: number },
): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (!box) return { top: (vh - card.h) / 2, left: (vw - card.w) / 2 };
  // A target that fills most of the screen leaves no free side: park the card in the corner.
  if (box.width > vw * 0.6 && box.height > vh * 0.5) {
    return { top: vh - card.h - 24, left: vw - card.w - 24 };
  }
  const right = box.left + box.width;
  const bottom = box.top + box.height;
  if (box.left < 120 && box.width < 320) {
    return {
      top: clamp(box.top - 8, MARGIN, vh - card.h - MARGIN),
      left: right + GAP,
    };
  }
  let top = bottom + GAP;
  if (top + card.h > vh - MARGIN) top = box.top - GAP - card.h;
  if (top < MARGIN) {
    // No room above or below: sit beside the target.
    top = clamp(box.top, MARGIN, vh - card.h - MARGIN);
    const side = right + GAP;
    const left = side + card.w > vw - MARGIN ? box.left - GAP - card.w : side;
    return { top, left: clamp(left, MARGIN, vw - card.w - MARGIN) };
  }
  return { top, left: clamp(box.left, MARGIN, vw - card.w - MARGIN) };
}

/** A spotlight on the target with a step card beside it. Esc skips; arrows move. */
export function TourOverlay({
  step,
  index,
  total,
  onNext,
  onBack,
  onSkip,
}: {
  step: TourStep;
  index: number;
  total: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const [box, setBox] = useState<Box | null>(null);
  const [card, setCard] = useState({ w: 320, h: 200 });
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const last = index === total - 1;

  // Find the target (it may still be loading after a route change), then follow it.
  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    let timer: number | undefined;

    function measure(el: HTMLElement): void {
      const r = el.getBoundingClientRect();
      // Keep the highlight inside the window; a tall table is outlined only where it is visible.
      const top = Math.max(r.top - PAD, 4);
      const left = Math.max(r.left - PAD, 4);
      const bottom = Math.min(r.bottom + PAD, window.innerHeight - 4);
      const right = Math.min(r.right + PAD, window.innerWidth - 4);
      setBox({
        top,
        left,
        width: Math.max(right - left, 0),
        height: Math.max(bottom - top, 0),
      });
    }

    function look(): void {
      if (cancelled) return;
      const el = findTarget(step.target);
      if (el) {
        el.scrollIntoView({ block: "nearest", behavior: "auto" });
        requestAnimationFrame(() => !cancelled && measure(el));
        return;
      }
      if (step.target && tries++ < 25) timer = window.setTimeout(look, 100);
    }
    look();

    const follow = () => {
      const el = findTarget(step.target);
      if (el) measure(el);
    };
    window.addEventListener("resize", follow);
    window.addEventListener("scroll", follow, true);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("resize", follow);
      window.removeEventListener("scroll", follow, true);
    };
  }, [step]);

  useLayoutEffect(() => {
    const el = cardRef.current;
    if (el && (el.offsetWidth !== card.w || el.offsetHeight !== card.h)) {
      setCard({ w: el.offsetWidth, h: el.offsetHeight });
    }
  }, [step, box, card.w, card.h]);

  useEffect(() => {
    nextRef.current?.focus();
  }, [step]);

  function onKeyDown(e: React.KeyboardEvent): void {
    if (e.key === "Escape") {
      e.preventDefault();
      onSkip();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      onNext();
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      onBack();
    } else if (e.key === "Tab") {
      // Keep focus inside the card.
      const items = cardRef.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled])",
      );
      if (!items || items.length === 0) return;
      const first = items[0];
      const lastItem = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  const pos = place(box, card);

  return createPortal(
    <div className="fixed inset-0 z-[70]" onKeyDown={onKeyDown}>
      {/* Swallows clicks so the page underneath can't be changed mid-tour. */}
      <div
        className={cn("absolute inset-0", !box && "bg-black/70")}
        aria-hidden="true"
      />
      {box && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-lg outline outline-2 outline-primary transition-[top,left,width,height] duration-200 motion-reduce:transition-none"
          style={{
            top: box.top,
            left: box.left,
            width: box.width,
            height: box.height,
            boxShadow: "0 0 0 9999px rgba(6, 11, 19, 0.72)",
          }}
        />
      )}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        className="tour-card absolute w-[min(20rem,calc(100vw-1.5rem))] rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-2xl"
        style={{ top: pos.top, left: pos.left }}
      >
        <p
          className="text-xs font-medium text-muted-foreground"
          aria-live="polite"
        >
          Step {index + 1} of {total}
        </p>
        <h2
          id="tour-title"
          className="mt-1 text-base font-semibold text-foreground"
        >
          {step.title}
        </h2>
        <p id="tour-body" className="mt-1.5 text-sm text-muted-foreground">
          {step.body}
        </p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={onSkip}>
            {last ? "Close" : "Skip tour"}
          </Button>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <Button variant="outline" size="sm" onClick={onBack}>
                Back
              </Button>
            )}
            <Button ref={nextRef} size="sm" onClick={onNext}>
              {last ? "Done" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
