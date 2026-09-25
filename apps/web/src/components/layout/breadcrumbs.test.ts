import { describe, expect, it } from "vitest";

import { breadcrumbsForPath } from "./breadcrumbs";

describe("breadcrumbsForPath", () => {
  it("shows only the section on a top-level page", () => {
    expect(breadcrumbsForPath("/")).toEqual([{ label: "Dashboard" }]);
    expect(breadcrumbsForPath("/approvals")).toEqual([{ label: "Approvals" }]);
  });

  it("links back through opportunity to the proposal builder", () => {
    expect(breadcrumbsForPath("/opportunities/7/versions/3")).toEqual([
      { label: "Opportunities", to: "/opportunities" },
      { label: "Opportunity", to: "/opportunities/7" },
      { label: "Proposal builder" },
    ]);
  });

  it("names an approval request detail page", () => {
    expect(breadcrumbsForPath("/approvals/12")).toEqual([
      { label: "Approvals", to: "/approvals" },
      { label: "Approval request" },
    ]);
  });

  it("marks unknown paths as not found", () => {
    expect(breadcrumbsForPath("/nope")).toEqual([{ label: "Not found" }]);
  });
});
