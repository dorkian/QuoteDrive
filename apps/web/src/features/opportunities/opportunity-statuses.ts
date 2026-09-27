// The API stores status as free text; the UI offers the pipeline stages the
// dashboard reports on. A legacy value outside this list stays selectable.
export const OPPORTUNITY_STATUSES = ["open", "won", "lost"] as const;
