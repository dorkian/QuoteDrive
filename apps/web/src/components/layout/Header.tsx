import type { Role } from "../../lib/api";

const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  proposal_manager: "Proposal Manager",
  approver: "Approver",
  viewer: "Viewer",
};

interface HeaderProps {
  organizationName: string;
  role: Role;
  onLogout: () => void;
}

export function Header({ organizationName, role, onLogout }: HeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-navy-800 bg-navy-950 px-6 py-4">
      <div>
        <p className="text-sm font-medium text-navy-50">{organizationName}</p>
        <p className="text-xs text-navy-300">{ROLE_LABELS[role]}</p>
      </div>
      <button
        type="button"
        onClick={onLogout}
        className="rounded-md px-3 py-1.5 text-sm text-navy-300 transition-colors duration-150 hover:bg-navy-800 hover:text-navy-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-400"
      >
        Log out
      </button>
    </header>
  );
}
