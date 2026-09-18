# AI Agent Delegation Playbook

## Roles
- **Product Owner/Tech Lead:** prioritizes, approves plans/ADRs, accepts work.
- **Copilot Planner:** turns requests into card-ready stories, criteria, tests, and dependencies; does not own architecture implementation.
- **Gemini Reviewer:** independent read-only exploration and review for scope, UX, tenancy, AI safety, and test gaps.
- **Claude Code Implementer:** uses Plan Mode then implements one approved card with proof.

## Task protocol
1. Planner refines card.
2. Product Owner approves Ready.
3. Claude Plan Mode validates files, risks, and commands.
4. Product Owner approves plan.
5. Claude implements only card scope.
6. Quality gates run.
7. Gemini reviews diff.
8. Claude fixes confirmed blocking/important findings.
9. Product Owner accepts and moves card to Done.

No agent adds dependencies, commits/pushes, deploys, changes secrets, or modifies paid/external systems without explicit approval.
