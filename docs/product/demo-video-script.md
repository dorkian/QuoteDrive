# Demo Video Script (QD-407)

Target length 4:30 (hard limit 5:00). One take per segment, cut together. No voice-over needed if the on-screen captions are used; a voice track can follow the same beats. Follows [demo-scenario.md](demo-scenario.md). Record last, on the tagged release (QD-408).

## Before recording
- Fresh clone at the release tag. `docker compose up -d --build`, `alembic upgrade head`, `seed_demo`. Do **not** run `seed_e2e` (the second tenant would show up).
- Real AI so the provenance badge reads "Generated locally with Ollama": `AI_PROVIDER=ollama OLLAMA_MODEL=qwen2.5:7b AI_REQUEST_TIMEOUT_SECONDS=120 docker compose up -d api`. Warm the model with one throwaway generation first; the real take still takes 20 to 40 seconds, so cut the wait to two seconds.
- Browser window 1440×900 (or 1280×720), zoom 100%, bookmarks bar and extensions hidden, one tab. Notifications off.
- Capture at 1080p, 30 fps. Caption font large enough to read on a phone.
- Rehearse the Viewer segment once to confirm what that role sees on an approved version. The script below assumes the client preview is readable and the builder actions are absent.
- Only synthetic data is on screen: Northstar Mobility Advisory, Lombarda Studio Group, `@northstar.example`. Check the browser's autofill and tab titles show nothing personal.

## Segments

| # | Time | Screen | Caption / voice-over |
|---|---|---|---|
| 1 | 0:00–0:15 | Sign-in screen with the four demo users and the "Synthetic demo data" line | "QuoteDrive: a multi-tenant proposal workspace where AI drafts and people decide. Everything you'll see is synthetic." |
| 2 | 0:15–0:45 | Sign in as **Proposal Manager**. Dashboard: pipeline counts, activity timeline. Open the opportunity "2026 Fleet Modernization & Mobility Services" | "Four roles per tenant. Every query is scoped to the tenant." |
| 3 | 0:45–1:25 | Discovery brief: paste the call notes, **Draft brief**, show the "Generated locally with Ollama" badge and "Requires human review" label, edit one line, **Save brief** | "AI drafts the brief. A person edits and saves. Nothing is saved automatically." |
| 4 | 1:25–2:05 | Create draft version. Add Electric City ×4, Hybrid Account Manager ×5, Long Distance ×3. Total reads **$7,528.00** with "Illustrative planning estimate only" | "The numbers come from the server's catalogue, never from the model." |
| 5 | 2:05–2:45 | **Generate draft** for the narrative, scroll the result (executive summary, approach, scope, email), fix one sentence, **Save**. Then **Finalize** | "The draft is checked against a schema and an output guard before a person sees it. Finalizing freezes the version." |
| 6 | 2:45–3:05 | **Submit for approval**, pick the approver, confirm | "Submitting assigns one approver. You can't approve your own work." |
| 7 | 3:05–3:40 | Log out, sign in as **Approver**. Approvals list, open the request, show the version comparison, **Approve** and confirm | "The approver sees what changed, then approves or requests changes with a comment." |
| 8 | 3:40–4:05 | Back as **Proposal Manager**: open **Client preview**, show the print-friendly page and the disclaimer. Then **Mark as shared** | "An approved version becomes a client-ready preview. QuoteDrive sends nothing; it records what happened." |
| 9 | 4:05–4:20 | Sign in as **Viewer**: read-only view of the approved proposal. Optional 3 seconds: **Admin** opens Settings › Members | "Viewers read. Admins manage members and the catalogue." |
| 10 | 4:20–4:30 | Repo README with the quality badges or the docs map | "React, FastAPI and Postgres. 8 ADRs, tenant-isolation tests, scored AI evals. Code and case study linked below." |

## Must show on screen (card acceptance)
- [ ] All four roles: Proposal Manager, Approver, Viewer, Admin.
- [ ] AI draft → human edit → approval → preview in one continuous story.
- [ ] "Illustrative planning estimate only" visible on the builder and the preview.
- [ ] "Synthetic demo data" visible on at least the sign-in screen and the preview.
- [ ] No real names, emails, keys or personal browser content.

## After recording
1. Review with the Product Owner (card evidence).
2. Upload (unlisted is fine), then add the link to the README under the title and to the release notes. Only add the link once the video exists, so the README never points at nothing.
3. Update `docs/product/plan-vs-built.md` row "Weekend 4: demo video and first case-study article".
