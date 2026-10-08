import { X } from "lucide-react";
import { useState, type KeyboardEvent } from "react";

import { FIELD_CLASSES } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Type a tag and press Enter or comma; Backspace on an empty box removes the last one. */
export function TagInput({
  id,
  value,
  onChange,
  max = 6,
  maxLength = 40,
  placeholder = "Add a tag",
}: {
  id?: string;
  value: string[];
  onChange: (tags: string[]) => void;
  max?: number;
  maxLength?: number;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const full = value.length >= max;

  function commit(): void {
    const tag = draft.trim().replace(/,$/, "").trim();
    setDraft("");
    if (
      !tag ||
      full ||
      value.some((t) => t.toLowerCase() === tag.toLowerCase())
    )
      return;
    onChange([...value, tag.slice(0, maxLength)]);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commit();
    } else if (event.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div
      className={cn(
        FIELD_CLASSES,
        "flex min-h-10 flex-wrap items-center gap-1.5 py-1.5",
      )}
    >
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-accent px-2 py-0.5 text-xs text-foreground"
        >
          {tag}
          <button
            type="button"
            aria-label={`Remove ${tag}`}
            onClick={() => onChange(value.filter((t) => t !== tag))}
            className="rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <X aria-hidden="true" className="size-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
        disabled={full}
        maxLength={maxLength}
        placeholder={full ? `Up to ${max} tags` : placeholder}
        className="min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
      />
    </div>
  );
}
