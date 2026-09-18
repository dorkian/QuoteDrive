# Data Model

## Tables
- `organizations(id, name, slug, settings_json, created_at)`
- `users(id, email, display_name, created_at)`
- `organization_memberships(user_id, organization_id, role)`
- `customers(id, organization_id, name, industry, status)`
- `opportunities(id, organization_id, customer_id, owner_id, title, status, brief_json)`
- `catalogue_items(id, organization_id, type, name, category, base_monthly_estimate, active)`
- `proposal_versions(id, organization_id, opportunity_id, version_number, status, content_json, total_estimate, created_by)`
- `proposal_line_items(id, proposal_version_id, item_id, quantity, unit_estimate, assumptions_json)`
- `approval_requests(id, organization_id, proposal_version_id, requested_by, assigned_to, status, decision_at)`
- `approval_comments(id, approval_request_id, author_id, body, created_at)`
- `audit_events(id, organization_id, actor_id, entity_type, entity_id, action, before_json, after_json, created_at)`
- `ai_generations(id, organization_id, proposal_version_id, feature, provider, model, prompt_version, input_hash, output_json, status, latency_ms, fallback_reason)`

## Tenant rule
Every tenant-owned table has `organization_id` directly or is reachable only through an already tenant-scoped parent. Services must perform authorization before returning records.
