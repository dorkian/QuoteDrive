import { Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { provenanceLabel } from "../../lib/provenance";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CARD_CLASSES } from "@/components/ui/variants";
import { cn } from "@/lib/utils";
import {
  generateDiscoveryBrief,
  saveOpportunityBrief,
  type Opportunity,
} from "../../lib/api";
import { describeError } from "../../lib/errors";

const LABEL = "mb-1 block text-sm text-muted-foreground";
// AI actions use the cyan info colour, keeping lime for human decisions.
const AI_BUTTON =
  "border-cyan-400/40 bg-cyan-400/10 text-info-foreground hover:bg-cyan-400/20";

type ListField = "requirements" | "open_questions" | "unknowns";

const LIST_FIELDS: { key: ListField; label: string }[] = [
  { key: "requirements", label: "Requirements" },
  { key: "open_questions", label: "Open questions" },
  { key: "unknowns", label: "Unknowns" },
];

interface Draft {
  summary: string;
  requirements: string;
  open_questions: string;
  unknowns: string;
  provider: string;
  model: string;
  fallback_reason?: string | null;
}

function toLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function asStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];
}

function SavedBrief({ brief }: { brief: Record<string, unknown> }) {
  const summary = typeof brief.summary === "string" ? brief.summary : null;
  return (
    <div className="space-y-4">
      {summary && <p className="text-sm text-foreground">{summary}</p>}
      {LIST_FIELDS.map(({ key, label }) => {
        const items = asStringList(brief[key]);
        return items.length === 0 ? null : (
          <div key={key}>
            <h3 className="text-sm text-muted-foreground">{label}</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground">
              {items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

interface DiscoveryBriefPanelProps {
  token: string;
  opportunity: Opportunity;
  editable: boolean;
  onSaved: (opportunity: Opportunity) => void;
}

export function DiscoveryBriefPanel({
  token,
  opportunity,
  editable,
  onSaved,
}: DiscoveryBriefPanelProps) {
  const [notes, setNotes] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate(): Promise<void> {
    setGenerating(true);
    setError(null);
    try {
      const res = await generateDiscoveryBrief(token, opportunity.id, notes);
      setDraft({
        summary: res.summary,
        requirements: res.requirements.join("\n"),
        open_questions: res.open_questions.join("\n"),
        unknowns: res.unknowns.join("\n"),
        provider: res.provider,
        model: res.model,
        ...(res.fallback_reason
          ? { fallback_reason: res.fallback_reason }
          : {}),
      });
      toast.success("AI brief ready. Review it before saving.");
    } catch (err) {
      const message = describeError(err, {
        action: "draft a discovery brief",
      }).message;
      setError(message);
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave(): Promise<void> {
    if (!draft) {
      return;
    }
    setSaving(true);
    setError(null);
    const brief: Parameters<typeof saveOpportunityBrief>[2] = {
      summary: draft.summary.trim(),
      requirements: toLines(draft.requirements),
      open_questions: toLines(draft.open_questions),
      unknowns: toLines(draft.unknowns),
      provider: draft.provider,
      model: draft.model,
      ...(draft.fallback_reason
        ? { fallback_reason: draft.fallback_reason }
        : {}),
    };
    try {
      const saved = await saveOpportunityBrief(token, opportunity.id, brief);
      onSaved(saved);
      setDraft(null);
      setNotes("");
      toast.success("Discovery brief saved");
    } catch (err) {
      const message = describeError(err, {
        action: "save the discovery brief",
      }).message;
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  const saved = opportunity.brief_json;

  return (
    <section className={cn(CARD_CLASSES, "mt-8 p-4 sm:p-6")}>
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-lg font-semibold text-foreground">
          Discovery brief
        </h2>
        <Badge variant="info">
          <Sparkles aria-hidden="true" />
          AI
        </Badge>
      </div>

      {saved ? (
        <SavedBrief brief={saved} />
      ) : (
        <p className="text-sm text-muted-foreground">No brief saved yet.</p>
      )}

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-destructive-foreground"
        >
          {error}
        </p>
      )}

      {editable && !draft && (
        <div className="mt-6">
          <label htmlFor="discovery-notes" className={LABEL}>
            Discovery notes
          </label>
          <Textarea
            id="discovery-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={8000}
            placeholder="Paste call or meeting notes…"
            className="min-h-[120px] text-base sm:text-sm"
          />
          <Button
            variant="outline"
            onClick={() => void handleGenerate()}
            disabled={!notes.trim() || generating}
            className={cn(AI_BUTTON, "mt-3")}
          >
            <Sparkles aria-hidden="true" />
            {generating ? "Drafting…" : "Draft brief"}
          </Button>
        </div>
      )}

      {draft && (
        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background p-3">
            <Badge variant="info">
              {provenanceLabel(draft.provider, draft.fallback_reason)}
            </Badge>
            <Badge variant="warning">
              Draft AI Content — Requires human review
            </Badge>
          </div>
          <div>
            <label htmlFor="brief-summary" className={LABEL}>
              Summary
            </label>
            <Textarea
              id="brief-summary"
              value={draft.summary}
              onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
              className="min-h-[80px] text-base sm:text-sm"
            />
          </div>
          {LIST_FIELDS.map(({ key, label }) => (
            <div key={key}>
              <label htmlFor={`brief-${key}`} className={LABEL}>
                {label} (one per line)
              </label>
              <Textarea
                id={`brief-${key}`}
                value={draft[key]}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                className="min-h-[80px] text-base sm:text-sm"
              />
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => void handleSave()}
              disabled={saving || !draft.summary.trim()}
            >
              {saving ? "Saving…" : "Save brief"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setDraft(null)}
              disabled={saving}
            >
              Discard
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
