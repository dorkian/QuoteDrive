# Claude Code Playbook

Use Claude Code as the implementation owner only after a card is Ready.

## Start prompt
Read `CLAUDE.md`, `AGENTS.md`, the active Trello card, linked ADRs, and relevant source/tests. Enter Plan Mode. Do not edit until you return files/modules, a minimal ordered plan, risks, and exact verification commands.

## Implementation rules
- Work on one card only.
- Do not expand scope or refactor unrelated code.
- Do not add packages without approval.
- Enforce tenant scope and server-side state transitions.
- Use FakeProvider in tests; never call live model APIs in CI.

## Completion report
Provide files changed, acceptance criteria status, commands/results, test additions, limitations, and a three-line Completion TL;DR. Generate a Trello update payload; do not move to Done automatically.
