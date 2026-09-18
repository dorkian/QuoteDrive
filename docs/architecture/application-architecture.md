# Application Architecture

## Style
Use a modular monolith: one React application, one FastAPI application, and one PostgreSQL database. Modules provide boundaries without premature distributed-system complexity.

## Backend modules
- `identity`: demo authentication, membership, active organization context
- `customers`: customer companies and contacts
- `opportunities`: opportunity lifecycle and commercial brief
- `catalogue`: packages, add-ons, synthetic estimate inputs
- `proposals`: versions, line snapshots, approval requests
- `audit`: append-only action events
- `ai`: request validation, provider adapters, generation records

## Invariants
- Tenant scope comes from authenticated membership.
- Server-side code owns state transitions and calculations.
- Approved versions are immutable snapshots.
- AI output is an editable draft, never a state-changing command.
