---
name: e2e-sync
description: Use whenever a change touches UI under apps/web/src (components, routes, nav items, button or link text, labels, headings, dialog titles, toasts, or the order of steps in a flow) that the Playwright suite in apps/web/e2e may depend on. Checks the E2E specs and playwright.config.ts for impact and fixes them in the same change instead of letting CI find the break.
---

# E2E sync

The Playwright suite (`apps/web/e2e/`, config `apps/web/playwright.config.ts`) drives the app through accessible names and routes. A markup change that renames or reorders what the specs query breaks the suite silently until E2E runs. Check it in the same change.

## 1. Find the impact
Diff the UI change against what the specs depend on:
- Accessible names queried by `getByRole(..., { name })`, `getByLabel`, and `getByText` (buttons, links, headings, dialog titles, toasts, empty and error states).
- Routes and URL patterns: `nav-items.ts`, router paths, `page.goto(...)`, `toHaveURL(...)`.
- Flow order: a new confirmation dialog, a removed step, a moved control.
- Displayed values the specs assert on, such as the total format (`$7,528.00` on the preview, `$7528.00` in the builder).
- Environment in `playwright.config.ts`: base URL, ports, `E2E_API_URL`, and compose ports or CORS origin if those changed.

`grep -rn "<old text>" apps/web/e2e` for every renamed string. No hits means no E2E impact; say so in the report.

## 2. Fix
- Update selectors or steps in `apps/web/e2e/*.spec.ts` and `helpers.ts`. Touch `playwright.config.ts` only when a route, port or start command really changed.
- Keep the suite's rules: role/label selectors first, `data-testid` only when nothing accessible exists, no fixed waits (`waitForTimeout`), no weakened or deleted assertions.
- A **behaviour** change (different outcome, removed safeguard, new permission rule) is not a selector fix. Flag it to the user instead of rewriting the spec to pass.

## 3. Verify
With the compose stack up and seeded (`docs/quality/quality-gates.md`), run the affected specs from `apps/web`:

```bash
E2E_API_URL=http://localhost:${API_PORT:-8000} npx playwright test <spec>
```

If the stack is not running, say so. Never report the specs as passing without a run.

## 4. Report
Add an "E2E impact" line to the Trello work log: the specs updated and run, with the result, or "no E2E impact" and why.
