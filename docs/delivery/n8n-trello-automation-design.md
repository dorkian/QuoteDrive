# n8n + Trello Automation Design

## Selected staged mode
Start with agent-produced structured updates and Product Owner review. Add n8n after card format stabilizes.

## Flow
Agent output JSON → local/repository review → n8n webhook → schema validation → find card by QD-ID → append comment + checklist evidence → move only to Review → Product Owner approval → Done.

## Safeguards
- Restrict credentials to the QuoteDrive board.
- Allow only expected fields/list transitions.
- Never delete/archive cards automatically.
- Never move a card to Done without explicit Product Owner approval.
- Persist webhook failures to a visible error log.
