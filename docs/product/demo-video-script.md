# Demo Video Script (QD-407)

Target length 4:50 (hard limit 5:00). One take per segment, cut together. No voice-over needed if the on-screen captions are used; a voice track can follow the same beats. Follows [demo-scenario.md](demo-scenario.md). Record last, on the tagged release (QD-408).

## Before recording
- Fresh clone at the release tag. `docker compose up -d --build`, `alembic upgrade head`, `seed_demo`. Do **not** run `seed_e2e` (the second tenant would show up).
- Seed the story: `docker compose exec api python -m scripts.seed_demo_history` gives the dashboard ten weeks of fictional history. Start the take from a fresh browser profile so the first-visit tour and tips appear.
- Real AI so the provenance badge reads "Generated locally with Ollama": `AI_PROVIDER=ollama OLLAMA_MODEL=qwen2.5:7b AI_REQUEST_TIMEOUT_SECONDS=120 docker compose up -d api`. Warm the model with one throwaway generation first; the real take still takes 20 to 40 seconds, so cut the wait to two seconds.
- Browser window 1440×900 (or 1280×720), zoom 100%, bookmarks bar and extensions hidden, one tab. Notifications off.
- Capture at 1080p, 30 fps. Caption font large enough to read on a phone.
- Rehearse the Viewer segment once to confirm what that role sees on an approved version. The script below assumes the client preview is readable and the builder actions are absent.
- Only synthetic data is on screen: Northstar Mobility Advisory, Lombarda Studio Group, `@northstar.example`. Check the browser's autofill and tab titles show nothing personal.

## Segments

| # | Time | Screen | Caption / voice-over |
|---|---|---|---|
| 1 | 0:00–0:15 | Sign-in screen with the four demo users and the "Synthetic demo data" line | "QuoteDrive: a multi-tenant proposal workspace where AI drafts and people decide. Everything you'll see is synthetic." |
| 2 | 0:15–0:40 | Sign in as **Proposal Manager** on a fresh browser profile. The **product tour** starts: welcome, then the spotlight on the KPI strip. Skip the rest, or let two steps play | "First visit? A one-minute tour, replayable from Help." |
| 3 | 0:40–1:05 | **Dashboard** in one screen: hover the weekly chart, click a pipeline stage, hover the outcomes donut, switch 12 weeks to 4 weeks | "Everything on one screen. Hover any chart for detail, or switch the range." |
| 4 | 1:05–1:30 | **Opportunities** list: coloured status pills, filter chip "Needs attention", click a row. The side panel slides in with the **Next step** card ("Start with a discovery brief") | "Click a row and the details open beside the list. The panel always says what to do next." |
| 5 | 1:30–2:00 | In the panel, **Draft with AI**: paste the call notes, show the "Generated locally with Ollama" badge and "Requires human review" label, edit one line, **Save brief** | "AI drafts the brief. A person edits and saves. Nothing is saved automatically." |
| 6 | 2:00–2:30 | Panel → **Proposals** tab → Create draft version. In the builder, point at the journey stepper, add Electric City ×4, Hybrid Account Manager ×5, Long Distance ×3. Total **$7,528.00** with "Illustrative planning estimate only" | "Five steps, and the AI step is right there. The numbers come from the server's catalogue, never the model." |
| 7 | 2:30–3:00 | **Draft with AI** for the narrative, fix one sentence, **Save**. **Finalize**, then **Submit for approval**, pick the approver | "The draft passes a schema and an output guard before a person sees it. Submitting assigns one approver." |
| 8 | 3:00–3:30 | Sign in as **Approver**. Approvals table (Waiting column), open the request, version comparison, **Approve** | "The approver sees what changed, then approves or requests changes." |
| 9 | 3:30–4:00 | Back as **Proposal Manager**: breadcrumb shows the real names, open **Client preview** (note the full menu bar), then **Mark as shared** | "An approved version becomes a client-ready preview. QuoteDrive sends nothing; it records what happened." |
| 10 | 4:00–4:30 | **Customers**: open a customer modal, click one of its opportunities (the side panel opens on top, same page), press Esc twice. Sign in as **Viewer** for three seconds (no edit buttons), then **Admin** opens Settings › Members | "Customers, people and permissions: viewers read, admins manage." |
| 11 | 4:30–4:50 | Repo README or the docs map | "React, FastAPI and Postgres. 8 ADRs, tenant-isolation tests, scored AI evals. Code and case study linked below." |

## Must show on screen (card acceptance)
- [ ] All four roles: Proposal Manager, Approver, Viewer, Admin.
- [ ] AI draft → human edit → approval → preview in one continuous story.
- [ ] The dashboard, a list-to-panel open, and the first-visit tour.
- [ ] "Illustrative planning estimate only" visible on the builder and the preview.
- [ ] "Synthetic demo data" visible on at least the sign-in screen and the preview.
- [ ] No real names, emails, keys or personal browser content.

## After recording
1. Review with the Product Owner (card evidence).
2. Upload (unlisted is fine), then add the link to the README under the title and to the release notes. Only add the link once the video exists, so the README never points at nothing.
3. Update `docs/product/plan-vs-built.md` row "Weekend 4: demo video and first case-study article".
