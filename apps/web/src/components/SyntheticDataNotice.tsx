/** Reminds every viewer that all content is fictional (synthetic-data policy). */
export function SyntheticDataNotice({ className }: { className?: string }) {
  return (
    <p className={className ?? "text-xs text-muted-foreground"}>
      Synthetic demo data. All companies, people and figures are fictional.
    </p>
  );
}
