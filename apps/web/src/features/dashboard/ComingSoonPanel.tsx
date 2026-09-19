interface ComingSoonPanelProps {
  title: string;
}

export function ComingSoonPanel({ title }: ComingSoonPanelProps) {
  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-navy-50">
        {title}
      </h1>
      <p className="mt-1 text-sm text-navy-300">
        This area is coming in a later build.
      </p>
    </div>
  );
}
