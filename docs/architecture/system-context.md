# System Context

```text
Proposal Manager / Approver / Viewer
            │ browser
            ▼
      React + TypeScript
            │ HTTPS/JSON
            ▼
         FastAPI API
     ┌──────┼───────────────┐
     ▼      ▼               ▼
PostgreSQL  AI service    Audit service
            │
   one configured provider: OpenRouter | Ollama | FakeProvider
   (automatic fallback planned, not built; ADR-005)
```

External inference is used only for synthetic or permitted data in this educational project. Trello is a delivery-management system and is not part of QuoteDrive runtime architecture.
