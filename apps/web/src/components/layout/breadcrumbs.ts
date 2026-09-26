import { NAV_PATHS, navItemForPath } from "./nav-items";

export interface Crumb {
  label: string;
  // Omitted for the current page.
  to?: string;
}

/** Derives the header breadcrumb trail from a pathname in the app shell. */
export function breadcrumbsForPath(pathname: string): Crumb[] {
  const section = navItemForPath(pathname);
  const sectionPath = NAV_PATHS[section];
  const rest = pathname.slice(sectionPath.length).split("/").filter(Boolean);

  if (section === "Dashboard" && pathname !== "/") {
    return [{ label: "Not found" }];
  }
  if (rest.length === 0) {
    return [{ label: section }];
  }

  const crumbs: Crumb[] = [{ label: section, to: sectionPath }];
  if (section === "Opportunities") {
    const [opportunityId, versions, versionId] = rest;
    const opportunityPath = `${sectionPath}/${opportunityId}`;
    if (versions === "versions" && versionId) {
      crumbs.push({ label: "Opportunity", to: opportunityPath });
      crumbs.push({ label: "Proposal builder" });
    } else {
      crumbs.push({ label: "Opportunity" });
    }
  } else if (section === "Approvals") {
    crumbs.push({ label: "Approval request" });
  } else {
    crumbs.push({ label: "Details" });
  }
  return crumbs;
}
