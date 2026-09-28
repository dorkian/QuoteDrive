import { useEffect, useId, useState } from "react";
import { toast } from "sonner";

import { CARD_CLASSES } from "@/components/ui/variants";
import { cn } from "@/lib/utils";
import {
  ErrorState,
  LoadingRegion,
  Skeleton,
} from "../../components/states/StateViews";
import {
  fetchOrganizationSettings,
  updateOrganizationSettings,
  type OrganizationSettings,
} from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { describeError, type ErrorDescription } from "../../lib/errors";

export function AiSettingsPanel() {
  const { token, me } = useAuth();
  const [current, setCurrent] = useState<OrganizationSettings | null>(null);
  const [error, setError] = useState<ErrorDescription | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const hintId = useId();
  const labelId = useId();

  useEffect(() => {
    if (!token) {
      return;
    }
    fetchOrganizationSettings(token)
      .then(setCurrent)
      .catch((err: unknown) =>
        setError(
          describeError(err, { action: "load AI settings", role: me?.role }),
        ),
      );
  }, [token, me?.role, attempt]);

  async function toggle(enabled: boolean): Promise<void> {
    if (!token) {
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await updateOrganizationSettings(token, {
        ai_fallback_enabled: enabled,
      });
      setCurrent(updated);
      toast.success(
        enabled ? "Local fallback turned on" : "Local fallback turned off",
      );
    } catch (err) {
      setSaveError(
        describeError(err, {
          action: "change AI settings",
          role: me?.role,
        }).message,
      );
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return (
      <ErrorState
        message={error.message}
        onRetry={
          error.retryable
            ? () => {
                setError(null);
                setAttempt((n) => n + 1);
              }
            : undefined
        }
      />
    );
  }
  if (current === null) {
    return (
      <LoadingRegion label="AI settings loading" className="mt-4">
        <Skeleton className="h-24" />
      </LoadingRegion>
    );
  }

  const unavailable = !current.ai_fallback_available;

  return (
    <div className={cn(CARD_CLASSES, "max-w-2xl p-4 sm:p-6")}>
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          role="switch"
          checked={current.ai_fallback_enabled}
          disabled={saving}
          aria-labelledby={labelId}
          aria-describedby={hintId}
          onChange={(event) => void toggle(event.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-lime-400"
        />
        <span>
          <span id={labelId} className="text-sm font-medium text-foreground">
            Allow local fallback (Ollama) when OpenRouter is unavailable
          </span>
          <span
            id={hintId}
            className="mt-1 block max-w-prose text-sm text-muted-foreground"
          >
            QuoteDrive always retries a failed request once. With this on, a
            second timeout or outage sends the request to the local model
            instead, and the draft is labelled with the reason. Local drafts can
            be less polished; they still need human review.
          </span>
        </span>
      </label>
      {unavailable && (
        <p className="mt-4 rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">
          This deployment has no fallback provider configured
          (AI_FALLBACK_PROVIDER), so the setting has no effect yet.
        </p>
      )}
      {saveError && (
        <p className="mt-4 text-sm text-destructive-foreground" role="alert">
          {saveError}
        </p>
      )}
    </div>
  );
}
