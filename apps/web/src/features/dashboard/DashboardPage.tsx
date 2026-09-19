export function DashboardPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-navy-50">
        Dashboard
      </h1>
      <p className="mt-1 text-sm text-navy-300">
        Summaries and recent activity land here in a later build.
      </p>

      <div
        className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        role="status"
        aria-label="Dashboard content loading"
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-lg border border-navy-800 bg-navy-900 p-4"
          >
            <div className="h-3 w-1/3 rounded bg-navy-700" />
            <div className="mt-4 h-6 w-2/3 rounded bg-navy-700" />
          </div>
        ))}
      </div>
    </div>
  );
}
