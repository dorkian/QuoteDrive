import { useState } from "react";

import { useAuth } from "../../lib/auth-context";

const DEMO_USERS = [
  { email: "admin@northstar.example", role: "Admin" },
  { email: "manager@northstar.example", role: "Proposal Manager" },
  { email: "approver@northstar.example", role: "Approver" },
  { email: "viewer@northstar.example", role: "Viewer" },
];

export function LoginScreen() {
  const { login, error } = useAuth();
  const [pending, setPending] = useState<string | null>(null);

  async function handleSelect(email: string): Promise<void> {
    setPending(email);
    await login(email);
    setPending(null);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-navy-950 px-4 text-navy-50">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">QuoteDrive</h1>
          <p className="mt-2 text-sm text-navy-300">
            Sign in as a demo user to continue
          </p>
        </div>

        <div className="flex flex-col gap-2" role="list">
          {DEMO_USERS.map(({ email, role }) => (
            <button
              key={email}
              type="button"
              role="listitem"
              onClick={() => void handleSelect(email)}
              disabled={pending !== null}
              className="group flex items-center justify-between rounded-lg border border-navy-700 bg-navy-900 px-4 py-3 text-left transition-colors duration-150 hover:border-lime-400 hover:bg-navy-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span>
                <span className="block text-sm font-medium text-navy-50 group-hover:text-lime-400">
                  {role}
                </span>
                <span className="block text-xs text-navy-300">{email}</span>
              </span>
              {pending === email && (
                <span className="text-xs text-navy-300" role="status">
                  Signing in…
                </span>
              )}
            </button>
          ))}
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-400" role="alert">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
