# ADR-002: Shared-database organization tenancy

## Decision
Use shared PostgreSQL tables with mandatory `organization_id` and server-side tenant scoping.

## Consequence
Tenant-isolation tests are release-blocking. Database-per-tenant is deferred until real requirements justify it.

## Confirmed by QD-003
The role/permission model (`security-and-tenancy.md` § Roles and permissions) fits inside the existing shared-table + `organization_id` design — no schema-per-tenant or per-role table split is needed.
