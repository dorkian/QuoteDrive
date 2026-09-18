# AI Provider Failure Runbook

1. Confirm user is authorized and input schema is valid.
2. Check provider status, configured model, timeout, and non-secret logs.
3. Retry once only for transient transport/provider failure.
4. If enabled, use Ollama fallback and show fallback provenance.
5. If fallback fails/unavailable, preserve existing proposal content and show retry guidance.
6. Record provider/model/status/latency/fallback reason without secrets.
7. Do not change proposal workflow state because generation failed.
