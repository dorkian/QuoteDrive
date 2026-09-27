# Functional Requirements

## FR-01 Tenant workspace and roles
- Seeded demo login supports Admin, Proposal Manager, Approver, and Viewer.
- The backend obtains tenant context from authenticated membership, never from a trusted client organization ID.
- Tenant-owned reads and writes are organization-scoped.

## FR-02 Customers and opportunities
- Create, list, search, and update fictional customer companies.
- Create an opportunity linked to a customer and owner.
- Store a structured commercial brief, status, and activity history.

## FR-03 Catalogue and configuration
- Admin manages active synthetic packages/add-ons.
- Proposal Manager adds catalogue lines, quantities, and assumptions to a draft version.
- Inactive items cannot be selected.

## FR-04 Estimate and versioning
- The server calculates `line total = (base monthly estimate + add-on total) × quantity`.
- Proposal total is the sum of line totals.
- Every preview shows a non-binding illustrative-estimate disclaimer.
- Editing an approved/shared proposal creates a new version; previous versions remain unchanged.

## FR-05 Approval and audit
- Manager submits a configured version for review.
- Approver approves or requests changes with a comment.
- A proposal owner cannot approve their own version.
- Material actions create audit events.

## FR-06 AI drafting
- Narrative generator produces draft executive summary, scope, assumptions, exclusions, next steps, and email draft.
- Discovery-note extractor produces typed draft requirements and open questions.
- Generated content is editable, labelled as draft, and never changes workflow state automatically.
- Provider/model/prompt version/latency/fallback reason are recorded. *(v1.0.0 records provider, model, prompt version, status, latency and error; no fallback exists yet.)*
