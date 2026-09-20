import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  createProposalVersion,
  fetchOpportunity,
  fetchProposalVersions,
  type Opportunity,
  type ProposalVersion,
} from "../../lib/api";
import { useAuth } from "../../lib/auth-context";

function canEdit(role: string): boolean {
  return role === "admin" || role === "proposal_manager";
}

export function OpportunityDetailPage() {
  const { token, me } = useAuth();
  const navigate = useNavigate();
  const { opportunityId } = useParams<{ opportunityId: string }>();
  const id = Number(opportunityId);

  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [versions, setVersions] = useState<ProposalVersion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!token || Number.isNaN(id)) {
      return;
    }
    Promise.all([fetchOpportunity(token, id), fetchProposalVersions(token, id)])
      .then(([fetchedOpportunity, fetchedVersions]) => {
        setOpportunity(fetchedOpportunity);
        setVersions(fetchedVersions);
      })
      .catch(() =>
        setError("Couldn't load this opportunity. Try refreshing the page."),
      );
  }, [token, id]);

  async function handleCreateDraft(): Promise<void> {
    if (!token) {
      return;
    }
    setCreating(true);
    try {
      const version = await createProposalVersion(token, id);
      navigate(`/opportunities/${id}/versions/${version.id}`);
    } catch {
      setError("Couldn't create a draft version. Try again.");
      setCreating(false);
    }
  }

  const isLoading = opportunity === null || versions === null;

  return (
    <div>
      <Link
        to="/opportunities"
        className="text-xs text-navy-300 hover:text-lime-400"
      >
        ← Opportunities
      </Link>

      {error && (
        <p className="mt-4 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      {isLoading && !error ? (
        <div
          className="mt-4 h-24 animate-pulse rounded-md border border-navy-800 bg-navy-900"
          role="status"
          aria-label="Opportunity loading"
        />
      ) : (
        opportunity && (
          <>
            <div className="mt-2 flex items-center justify-between">
              <h1 className="text-xl font-semibold tracking-tight text-navy-50">
                {opportunity.title}
              </h1>
              {me && canEdit(me.role) && (
                <button
                  type="button"
                  onClick={() => void handleCreateDraft()}
                  disabled={creating}
                  className="rounded-md bg-lime-400 px-4 py-2 text-sm font-medium text-navy-950 transition-colors duration-150 hover:bg-lime-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {creating ? "Creating…" : "Create draft version"}
                </button>
              )}
            </div>

            <h2 className="mt-8 text-sm font-medium text-navy-50">
              Proposal versions
            </h2>
            {versions && versions.length === 0 ? (
              <p className="mt-2 text-sm text-navy-300">
                No proposal versions yet.
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {versions?.map((version) => (
                  <li key={version.id}>
                    <Link
                      to={`/opportunities/${id}/versions/${version.id}`}
                      className="flex items-center justify-between rounded-md border border-navy-800 bg-navy-900 px-4 py-3 transition-colors duration-150 hover:border-lime-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-400"
                    >
                      <span className="text-sm font-medium text-navy-50">
                        Version {version.version_number}
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="text-xs text-navy-300">
                          ${version.total_estimate}
                        </span>
                        <span className="rounded-full bg-navy-800 px-3 py-1 text-xs font-medium text-navy-50">
                          {version.status}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )
      )}
    </div>
  );
}
