# ADR-001: Modular monolith first

## Decision
Use one FastAPI modular monolith and one PostgreSQL database for the MVP.

## Rationale
Transactional workflows and rapid feedback matter more than distributed infrastructure. Explicit module boundaries preserve a future extraction path.

## Consequence
No microservices, queue, event broker, or Kubernetes in MVP.
