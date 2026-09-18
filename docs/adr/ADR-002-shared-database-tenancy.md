# ADR-002: Shared-database organization tenancy

## Decision
Use shared PostgreSQL tables with mandatory `organization_id` and server-side tenant scoping.

## Consequence
Tenant-isolation tests are release-blocking. Database-per-tenant is deferred until real requirements justify it.
