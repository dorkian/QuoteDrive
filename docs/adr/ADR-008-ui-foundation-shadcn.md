# ADR-008: UI foundation on in-repo shadcn/ui components, react-router retained

**Status:** Proposed. Needs PO approval; Claude may not approve ADRs.

## Decision
The web app's visual layer is built on shadcn/ui-style components kept in the repo (`apps/web/src/components/ui/`), on Radix primitives, class-variance-authority and Tailwind v4 semantic tokens. The Shadcn Admin template (satnaing/shadcn-admin, MIT) was the reference for the shell pattern: collapsible sidebar, breadcrumbs and a ⌘K command palette. The template was not forked, and its TanStack Router, Clerk auth and demo features were not adopted. Routing stays on `react-router-dom`, and `components/layout/nav-items.ts` stays the single source for navigation.

## Consequence
- The repo owns every component file, so changes are reviewed like any other code. Don't regenerate components with `npx shadcn add` over existing files without a diff review, because they carry QuoteDrive-specific tokens and 40px minimum touch targets.
- Colour roles live in `apps/web/src/index.css` as semantic tokens: lime `primary` only for actions and selection, cyan `info` for AI provenance, amber `warning` for review states, red `destructive` for blocking states. Screens use the tokens, not raw palette classes.
- Irreversible actions (finalize, approve, request changes) confirm in an AlertDialog. Mutations report through sonner toasts.
- The added dependencies cost about 42 kB gzip in the JS bundle (97.4 → 139 kB).

## Confirmed by QD-409
Branch `feat/ui-foundation`, commits 6c271aa through the step 6 commit. Evidence is in the QD-409 Trello work log and `specs/qd-409-ui-foundation.md`.
