import { useState } from "react";

import { DashboardLayout } from "./components/layout/DashboardLayout";
import type { NavItem } from "./components/layout/nav-items";
import { LoginScreen } from "./features/auth/LoginScreen";
import { ComingSoonPanel } from "./features/dashboard/ComingSoonPanel";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { AuthProvider, useAuth } from "./lib/auth-context";

function AppShell() {
  const { status, me, logout } = useAuth();
  const [active, setActive] = useState<NavItem>("Dashboard");

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-navy-950 text-navy-300">
        <span role="status">Loading…</span>
      </main>
    );
  }

  if (status === "unauthenticated" || !me) {
    return <LoginScreen />;
  }

  return (
    <DashboardLayout
      active={active}
      onSelect={setActive}
      organizationName={me.organization.name}
      role={me.role}
      onLogout={logout}
    >
      {active === "Dashboard" ? (
        <DashboardPage />
      ) : (
        <ComingSoonPanel title={active} />
      )}
    </DashboardLayout>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

export default App;
