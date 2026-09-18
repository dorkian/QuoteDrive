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
   OpenRouter primary ─── Ollama optional fallback
```

External inference is used only for synthetic or permitted data in this educational project. Trello is a delivery-management system and is not part of QuoteDrive runtime architecture.
