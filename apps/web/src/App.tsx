import { useMemo } from "react";
import {
  BrowserRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { DashboardLayout } from "./components/layout/DashboardLayout";
import { NAV_PATHS, navItemForPath } from "./components/layout/nav-items";
import { CustomersPage } from "./features/customers/CustomersPage";
import { LoginScreen } from "./features/auth/LoginScreen";
import { ComingSoonPanel } from "./features/dashboard/ComingSoonPanel";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { OpportunitiesListPage } from "./features/opportunities/OpportunitiesListPage";
import { OpportunityDetailPage } from "./features/opportunities/OpportunityDetailPage";
import { PackageComparison } from "./features/proposals/PackageComparison";
import { ProposalBuilder } from "./features/proposals/ProposalBuilder";
import { ApprovalDashboard } from "./features/approvals/ApprovalDashboard";
import { ApprovalDetail } from "./features/approvals/ApprovalDetail";
import { ProposalPreviewPage } from "./features/proposals/preview/ProposalPreviewPage";
import { AuthProvider, useAuth } from "./lib/auth-context";

function AppShell() {
  const { status, me, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const active = useMemo(
    () => navItemForPath(location.pathname),
    [location.pathname],
  );

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
      onSelect={(item) => navigate(NAV_PATHS[item])}
      organizationName={me.organization.name}
      role={me.role}
      onLogout={logout}
    >
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/opportunities" element={<OpportunitiesListPage />} />
        <Route
          path="/opportunities/:opportunityId"
          element={<OpportunityDetailPage />}
        />
        <Route
          path="/opportunities/:opportunityId/versions/:versionId"
          element={<ProposalBuilder />}
        />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/proposals" element={<PackageComparison />} />
        <Route path="/approvals" element={<ApprovalDashboard />} />
        <Route path="/approvals/:requestId" element={<ApprovalDetail />} />
        <Route
          path="/settings"
          element={<ComingSoonPanel title="Settings" />}
        />
        <Route path="*" element={<ComingSoonPanel title="Not found" />} />
      </Routes>
    </DashboardLayout>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Client-facing document: rendered outside the app shell (no nav chrome). */}
          <Route
            path="/proposal-versions/:versionId/preview"
            element={<ProposalPreviewPage />}
          />
          <Route path="/*" element={<AppShell />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
