---
name: trello-workflow
description: QuoteDrive's Trello card workflow — card template, checklist, lifecycle (Ready → In Progress → AI/Human Review → Done), work-log format, and write-access governance rules. Use whenever starting, updating, commenting on, or moving a QuoteDrive Trello card, or when creating/reviewing a card's description.
metadata:
  provenance: self-improving-skills

---
# QuoteDrive Trello workflow

## Governance rules (keep these fixed)

* Claude may:
  * Add comments with work logs and evidence.
  * Update checklists (Ready, Implementation, Verification, Review, Completion).
  * Update labels (e.g., add Blocked when needed).
  * Move a card from `In Progress` to `AI / Human Review` after proof.
* Claude may not:
  * Move a card to `Done`.
  * Change priorities or delete/archive cards.
  * Modify board structure (lists/labels).
  * Approve architecture decisions or ADRs.

## Card lifecycle with Claude + Trello connected

```
01 Ready
  → You assign a card and tell Claude: "Start QD-XXX"
  → Claude moves card to 02 In Progress (WIP 1)
  → Claude uses Plan Mode, returns a plan
  → You approve the plan
  → Claude implements only the approved scope
  → Claude runs quality gates (lint/typecheck/tests/build)
  → Claude adds a work-log comment and updates the checklist
  → Claude moves the card to 03 AI / Human Review (WIP 1)
  → You run Gemini review
  → Claude fixes confirmed Blocking/Important findings
  → You accept and move the card to 05 Done
```

## Working a card

Work on one active Trello card at a time. After implementation, run relevant quality commands (lint/typecheck/tests/build), then add a work-log comment to the active card with:

- Date, actor, action, result
- Files changed
- Commands run and outputs
- Test results
- Limitations

Update the card checklist (Ready / Implementation / Verification / Review / Completion) to reflect actual status. Move the card to list `03 AI / Human Review (WIP 1)` only after all quality gates pass. Close out with a Completion TL;DR (max 3 lines) for the Product Owner.

## Trello card template (ensure every card has this)

Each card description should include:

```
## TL;DR <!-- max 3 lines -->

## User story
As a <role>, I want <capability> so that <outcome>.

## Scope
- Included:
- Not included:

## Acceptance criteria
- [ ]

## Technical notes
- Expected modules/files:
- Dependencies:
- Risks:

## Test scenarios
### Happy path
Given ... When ... Then ...

### Failure/edge path
Given ... When ... Then ...

## AI evaluation (if relevant)
- Fixture:
- Expected assertion:
- Failure behavior:

## ADR / decisions
- ADR-XXX or N/A

## Evidence before Done
- [ ] Tests
- [ ] Format/lint/typecheck/build
- [ ] Review
- [ ] Documentation

## Work log <!-- date, actor, action, result -->

## Completion TL;DR <!-- change, proof, limitation; max 3 lines -->
```

Add a checklist to each card:

```
Ready
Implementation
Verification
Review
Completion
```
