import { useCallback, useEffect, useState } from "react";

import { useAuth } from "../../lib/auth-context";

const RESET_EVENT = "quotedrive:tips-reset";

function read(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}

function write(key: string, ids: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // Tips are a convenience; losing the "seen" state only shows one again.
  }
}

export function tipsKey(userId: number): string {
  return `quotedrive.tips.${userId}`;
}

export function tourKey(userId: number): string {
  return `quotedrive.tour.${userId}`;
}

export function resetTips(userId: number): void {
  write(tipsKey(userId), []);
  window.dispatchEvent(new Event(RESET_EVENT));
}

/** Whether a first-visit tip should show, and how to dismiss it for this user. */
export function useTip(id: string): { visible: boolean; dismiss: () => void } {
  const { me } = useAuth();
  const key = me ? tipsKey(me.user.id) : null;
  // Read the stored list for the *current* user while rendering, so a tip that was
  // already dismissed never flashes on the first render after sign-in.
  const [state, setState] = useState<{ key: string | null; ids: string[] }>(
    () => ({
      key,
      ids: key ? read(key) : [],
    }),
  );
  let current = state;
  if (state.key !== key) {
    current = { key, ids: key ? read(key) : [] };
    setState(current);
  }

  useEffect(() => {
    if (!key) return;
    const sync = () => setState({ key, ids: read(key) });
    window.addEventListener(RESET_EVENT, sync);
    return () => window.removeEventListener(RESET_EVENT, sync);
  }, [key]);

  const dismiss = useCallback(() => {
    if (!key) return;
    const ids = [...new Set([...read(key), id])];
    write(key, ids);
    setState({ key, ids });
  }, [key, id]);

  return { visible: !!key && !current.ids.includes(id), dismiss };
}
