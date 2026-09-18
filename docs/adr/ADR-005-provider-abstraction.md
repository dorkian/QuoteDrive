# ADR-005: OpenRouter primary, Ollama optional

## Decision
Use a provider interface with OpenRouter primary, Ollama optional fallback, and FakeProvider for tests.

## Consequence
Fallback is visible and only happens for permitted transient technical failures.
