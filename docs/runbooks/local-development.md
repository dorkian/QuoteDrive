# Local Development Runbook

## Prerequisites
Docker/Compose, Node LTS, Python 3.12+, and optionally Ollama for local fallback.

## Expected commands after scaffold exists
```bash
docker compose up --build
# frontend: http://localhost:5173
# API: http://localhost:8000/docs
```

Copy `.env.example` to `.env`; never commit values. OpenRouter is optional for local UI work. Tests use FakeProvider and do not require an API key.
