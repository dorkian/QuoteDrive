# ADR-006: Immutable proposal snapshots

## Decision
Submission creates a stable version for review. Approved/shared versions are immutable; edits create a new draft version.

## Consequence
Approvals remain traceable and audit timelines can compare stable artifacts.

## Confirmed by QD-003
The proposal lifecycle transition table (`security-and-tenancy.md` § Proposal lifecycle) formalizes this: for an existing submitted proposal, "request changes" and "edit approved/shared" are the only revision flows that spawn a new version, and approved/shared versions are never mutated in place. This is separate from initial proposal creation (`(new) → Draft`) and from creating alternative comparison versions on the same opportunity, which are new proposals rather than revisions.
