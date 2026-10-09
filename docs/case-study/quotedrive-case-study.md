# QuoteDrive: putting AI inside a business workflow without giving it the decisions

_A case study by Ash Dorkian. Everything in QuoteDrive is synthetic: fictional companies, packages and prices. Nothing here is a real quote._

**Repo:** github.com/dorkian/QuoteDrive · **Demo video:** `<link>` · **Built:** 2026-09-18 to 2026-10-09 (109 commits)

## The short version

QuoteDrive is a multi-tenant B2B proposal workspace for a fictional fleet-mobility advisory firm. A Proposal Manager turns a customer call into a discovery brief, configures packages, gets a price, drafts the proposal text, and sends it to a second person for approval. AI helps with the words. It never touches the numbers and never makes the decision.

> The calculator does the maths. The AI helps write the letter. A person checks the letter before anyone relies on it.

I built it in three weeks, with AI agents doing the implementation under a deliberate delivery process, and I tried to be honest about where the AI part is strong and where it is not.

## The problem

Proposal work usually lives in spreadsheets, documents and email. Scope drifts between versions, nobody can say who approved what, and the writing (summary, approach, scope, assumptions, next steps, cover email) is slow and repetitive. That writing is exactly what an LLM is good at. Prices, discounts and approvals are exactly what it must not own.

So the brief I set myself was narrow: **a credible SaaS slice where AI is useful but cannot make a commercial decision.** I also stated what was out of scope up front: no real payments, lending, credit scoring or e-signature, and no real data.

## What it does

Seven steps, four roles (Admin, Proposal Manager, Approver, Viewer), all scoped to the signed-in user's organization.

| Step               | Who      | What happens                                                                                                                                 |
| ------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Discovery brief | Manager  | Paste call notes. AI drafts a summary, requirements, open questions and unknowns. The manager edits and saves it.                            |
| 2. Configure       | Manager  | Pick packages and add-ons from the tenant's catalogue. The server calculates an illustrative monthly estimate.                               |
| 3. Draft narrative | Manager  | AI drafts the executive summary, approach, scope, assumptions, next steps and a cover email. Labelled "Requires human review".               |
| 4. Finalize        | Manager  | The version is frozen. Any later edit forks a new version.                                                                                   |
| 5. Approve         | Approver | Sees the version and its diff against the previous one, then approves or requests changes with a comment. Nobody can approve their own work. |
| 6. Share           | Manager  | An approved version renders as a print-friendly client preview. QuoteDrive sends nothing; it records what happened.                          |
| 7. Outcome         | Manager  | Mark it shared, then record Won, Lost or Expired. The dashboard counts outcomes.                                                             |

Around that journey sit the parts that make it feel like a product: a customer profile with a generated logo, industry, size, contact and about text; an Admin area for members, roles, the catalogue and AI settings; an interactive one-screen dashboard; an audit trail and activity timeline on every record; and a first-visit tour with tips.

## Three decisions that mattered

**1. Estimates are calculated on the server, never by AI (ADR-003).** The model receives the finished numbers as input. A language model that can "round" a price is a liability, so the architecture removes the option instead of asking nicely.

**2. Versions are immutable (ADR-006).** Finalizing freezes a snapshot. Editing a frozen version forks a new one. That is what makes approval and audit meaningful: the thing you approved is the thing that exists.

**3. Tenants share tables, and cross-tenant access returns 404, not 403 (ADR-002).** A 403 tells an attacker the row exists. A 404 does not. It is enforced on every query, and it is tested at three levels: unit tests, API tests and a Playwright end-to-end test.

I picked a modular monolith with one Postgres (ADR-001) on purpose. For a three-week solo build, microservices would have been a way to look sophisticated while shipping less.

## Making the AI part safe enough to ship

This is the section I would want a hiring manager to read. The AI is not one safeguard, it is layers, and each layer exists because of a specific failure:

1. **Numbers never come from the model.** Prevents invented prices.
2. **Untrusted input is fenced.** Call notes and customer profile text sit inside delimiters, and the system prompt says to treat them as data. The rule is restated _after_ the data. Prevents instructions hidden in notes.
3. **Output must parse into a fixed schema (ADR-007).** If it does not, the request fails cleanly with a 502 and nothing is saved.
4. **An output guard.** A draft is rejected if it contains figures that are not in the proposal data, or discount wording the priced lines do not support. The repo records that this caught a real prompt-injection success on a local model.
5. **Nothing auto-saves.** Drafts carry a "Draft AI Content, requires human review" label and are saved only when a person clicks Save, which writes an audit event.
6. **Provenance for every attempt.** Provider, model, prompt version, status and latency are logged, failures included. The UI shows a badge such as "Generated locally with Ollama".
7. **A provider abstraction with one retry and an opt-in fallback (ADR-005).** OpenRouter or local Ollama in production, a deterministic FakeProvider in tests. A transient failure is retried once. A tenant can opt in to falling back to Ollama, and the draft then shows why.

Role rules back this up. Only Admins and Proposal Managers can request a draft, and a failed or rejected draft never changes proposal state.

### Evidence, not claims

Fixture cases run in CI on every pull request against the FakeProvider. They cover a complete proposal in English and Italian, a missing estimate, a missing timeline, an unsupported discount, a negated discount ("no discount is offered"), and prompt injection inside the notes.

I also run them live against a real model and score them. Three runs per scenario, a 90% pass threshold, and zero tolerance for safety failures. The latest run on a local `qwen2.5:7b`:

- 10 scenarios, 30 runs: **93% passed**, mean check score 97%, **0 safety failures**.
- The weakest scenario was the one with a missing timeline: 1 of 3 runs passed. In the other two the output guard rejected the draft because it contained figures that were not in the proposal data. That is the guard doing its job, and it is the number I would rather show than hide.

The guard is heuristic. It is a floor, not a ceiling. The live eval is what tells me when it regresses.

## The part no spec covered: human taste

The first version of the UI matched the spec and passed its tests. Then I used it, and it felt like a database with a login. Customers were a table of three columns. Opening one threw you off the page. The AI feature was easy to miss.

So I iterated, one plain sentence at a time: "it looks so simple, I need a better SaaS feel"; "opening a customer should not lose my place"; "a first-time visitor will not realise they can draft with AI". Each sentence became a change: richer tables with consistent status colours, details that open in panels and modals and stack without leaving the page, a journey stepper that points at the AI step, a skippable first-visit tour, a customer profile with a logo mark, and an interactive dashboard.

One of those rounds also found a real bug: after creating an opportunity, the "New opportunity" form stayed open underneath the new side panel, because creating used to navigate away. I only saw it because I recorded the demo and looked. A spec would not have caught that, and neither did the tests until I wrote one.

The customer profile has a second purpose. Industry, company size, headquarters, about text and the contact's name and title are included in the AI prompts, so drafts address the right person and sound like they know the customer. The contact's email is never sent to the model, and the output guard still rejects any invented headcount.

My takeaway: specs get you to correct. People get you to good. The loop is the product.

## How it was delivered

I acted as Product Owner and tech lead. A planner agent refined cards, Claude Code implemented one approved card at a time, and a second model reviewed plans and diffs independently. The rules that kept it safe:

- Plan first, I approve, then implement only the card's scope.
- Quality gates before review: format, lint, typecheck, tests, build.
- Agents may not add dependencies, deploy, touch secrets or move a card to Done. Only I do that.
- Architecture decisions are written as ADRs, and only I accept them.

The process slowed some things down (extra approvals, plan steps) and prevented others (scope creep, silent dependency changes, unreviewed AI code). I would keep it.

## Results

|          |                                                                                               |
| -------- | --------------------------------------------------------------------------------------------- |
| Timeline | 2026-09-18 to 2026-10-09, 109 commits                                                         |
| API      | about 40 endpoints, 13 migrations, 360 tests, 98.5% coverage (floor 96%)                      |
| Web      | 275 tests, Playwright end-to-end for the golden path, the customer modal and tenant isolation |
| Security | cross-tenant 404 tests, gitleaks over full history, offline migration check in CI             |
| AI       | 10 live scored scenarios: 93% pass, 97% mean check score, 0 safety failures                   |
| Docs     | 8 ADRs, API contract, data model, runbooks, a plan-versus-built audit                         |

## What I would do differently, and what is still open

- **The plan-versus-built audit found that my planning docs promised more than was built.** Every gap became a card. Next time I would audit claims against code before a release, not near the end.
- **Docs drifted from code more than once.** I now treat docs as part of the diff.
- **End-to-end tests run manually, not on every pull request.** That was a deliberate sprint-time choice and is being reversed. I would rather say so than hide it.
- **A known gap shipped on purpose:** if a submit partly fails and the page is reloaded, a version can wait on "Awaiting approval" with no approver. It is rare, recoverable and documented.
- **AI quality with the customer-profile prompts is covered by unit and guard tests, not yet re-scored live.**
- **AI operations visibility is partial.** The dashboard shows AI draft health (success rate, number of generations, slowest response). It does not yet show cost per generation or a provider breakdown, because cost is not recorded.

## What is next

Out of scope for v1 by design: public deployment, SSO, email sending, PDF rendering and integrations. If I continued: invitations and real authentication, a hosted read-only demo with a spend cap on AI calls, per-generation cost tracking, and the live re-run of the evals with profile prompts.

## Links

Repository, demo video and the ADRs are linked at the top. If you are hiring for senior full-stack or applied-AI work, I would be glad to talk through any decision above.

---

### Appendix: complete feature list

- **Tenancy and access:** demo sign-in, four roles, organization scoping on every query, 404 on cross-tenant access.
- **Customers:** search, create, edit, delete; generated logo mark; website, headquarters, company size, about, industry tags, primary contact; a profile modal with stats and an activity tab.
- **Opportunities:** searchable, sortable table with status, owner and last activity; side panel with a "Next step" card; edit title and status; activity history.
- **Catalogue:** synthetic packages and add-ons; Admin can create, edit, deactivate and reactivate; inactive items cannot be quoted and saved versions keep their prices.
- **Proposal builder:** live server-calculated estimate, three-option comparison, a five-step journey stepper.
- **Versions:** immutable once finalized; edits fork a new version; version-to-version comparison.
- **Approvals:** submit with an approver picker, approve or request changes with a comment, no self-approval, a waiting-time column that flags overdue requests.
- **Audit and activity:** an audit event for every state change with the actor captured at write time; timelines on records and the dashboard.
- **AI:** discovery-brief drafting, proposal-narrative drafting, schema validation, output guard, prompt-injection fencing, retry, opt-in fallback, provenance badge, review label, a spinner while the model works.
- **Share and outcome:** print-friendly client preview, mark shared, record Won, Lost or Expired.
- **Dashboard:** KPI tiles with trends, weekly activity, pipeline funnel, outcomes donut, package mix, recent activity, a 4-week, 12-week and all-time range. Hand-built SVG, keyboard access and a table view for every chart.
- **Workspace settings:** members and roles, catalogue, AI provider opt-in.
- **Onboarding:** a skippable role-aware product tour, dismissible tips and a Help menu to replay them.
- **Quality:** fixture and live AI evals, Playwright end-to-end, coverage floors, gitleaks, an automated demo recorder.
