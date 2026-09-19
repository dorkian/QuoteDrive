# Demo Scenario

All entities below are fictional. See `docs/product/synthetic-data-policy.md`.

## Demo tenant
Northstar Mobility Advisory — a fictional B2B mobility consultancy. Organization Admin role owns the tenant workspace, catalogue, and members.

## Demo tenant users
Seeded demo logins (FR-01), one per role, under Northstar Mobility Advisory:
- Admin: `admin@northstar.example`
- Proposal Manager: `manager@northstar.example`
- Approver: `approver@northstar.example`
- Viewer: `viewer@northstar.example`

Seed fixtures for QD-101 (demo authentication) should use these exact addresses.

## Demo customer
Lombarda Studio Group — a fictional 90-person professional-services firm.

## Fleet scenario
Canonical seed opportunity: **"2026 Fleet Modernization & Mobility Services"** — Northstar prepares an illustrative 12-vehicle mobility-services proposal for Lombarda Studio Group:
- 4 electric city vehicles
- 5 hybrid vehicles
- 3 long-distance vehicles

Catalogue packages map to these three vehicle categories (`catalogue_items.type`/`category`), plus optional maintenance and roadside-assistance add-ons. Actual illustrative pricing (`base_monthly_estimate`) is defined by the catalogue seed data (QD-202), not by this document. This opportunity title is the canonical fixture name for QD-201 (customer/opportunity API) and QD-307 (AI evaluation fixtures) to keep seed data consistent across cards.

## Disclaimer
Every estimate and proposal preview in this scenario shows "Illustrative planning estimate only," per FR-04.
