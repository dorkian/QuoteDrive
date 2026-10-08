import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../../lib/auth-context";
import { TourContext } from "./tour-context";
import { tourFor } from "./tour-steps";
import { tourKey } from "./tips";
import { TourOverlay } from "./TourOverlay";

/** Automation (and anyone who never wants the tour) sets this flag to skip it entirely. */
const SKIP_FLAG = "quotedrive.tour.skip";

function hasSeen(key: string): boolean {
  try {
    return (
      localStorage.getItem(key) === "done" ||
      localStorage.getItem(SKIP_FLAG) === "1"
    );
  } catch {
    return true; // Without storage we can't remember, so don't nag.
  }
}

/**
 * Owns the product tour: shows it once on a user's first sign-in (when
 * `autoStart` is on), and again whenever Help › Take the tour is chosen.
 */
export function TourProvider({
  children,
  autoStart = true,
}: {
  children: ReactNode;
  autoStart?: boolean;
}) {
  const { me } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const steps = useMemo(() => (me ? tourFor(me.role) : []), [me]);
  const [index, setIndex] = useState<number | null>(null);
  const key = me ? tourKey(me.user.id) : null;

  const finish = useCallback(() => {
    setIndex(null);
    if (key) {
      try {
        localStorage.setItem(key, "done");
      } catch {
        // Nothing to do; the tour may show again next visit.
      }
    }
  }, [key]);

  useEffect(() => {
    if (!autoStart || !key || hasSeen(key)) return;
    const timer = window.setTimeout(() => setIndex(0), 900);
    return () => window.clearTimeout(timer);
  }, [autoStart, key]);

  const step = index === null ? null : steps[index];
  useEffect(() => {
    if (step?.route && location.pathname !== step.route) navigate(step.route);
    // Only react to a new step, not to the route it just moved us to.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const api = useMemo(
    () => ({ start: () => setIndex(0), active: index !== null }),
    [index],
  );

  return (
    <TourContext.Provider value={api}>
      {children}
      {step && index !== null && (
        <TourOverlay
          key={step.id}
          step={step}
          index={index}
          total={steps.length}
          onNext={() =>
            index >= steps.length - 1 ? finish() : setIndex(index + 1)
          }
          onBack={() => setIndex(Math.max(0, index - 1))}
          onSkip={finish}
        />
      )}
    </TourContext.Provider>
  );
}
