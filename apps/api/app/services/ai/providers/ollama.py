import time

import httpx

from app.services.ai.providers.base import (
    GenerationProvider,
    GenerationRequest,
    GenerationResult,
    ProviderResponseError,
    ProviderTimeoutError,
)


class OllamaProvider(GenerationProvider):
    def __init__(
        self,
        base_url: str,
        model: str,
        timeout_seconds: float,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._client = httpx.Client(transport=transport, timeout=timeout_seconds)

    def generate(self, request: GenerationRequest) -> GenerationResult:
        body: dict[str, object] = {
            "model": self._model,
            "prompt": request.prompt,
            "stream": False,
        }
        if request.system:
            body["system"] = request.system
        options: dict[str, object] = {}
        if request.max_tokens is not None:
            options["num_predict"] = request.max_tokens
        if request.temperature is not None:
            options["temperature"] = request.temperature
        if options:
            body["options"] = options

        started = time.monotonic()
        try:
            response = self._client.post(f"{self._base_url}/api/generate", json=body)
        except httpx.TimeoutException as exc:
            raise ProviderTimeoutError("Ollama request timed out") from exc
        except httpx.HTTPError as exc:
            raise ProviderResponseError(f"Ollama request failed: {exc}") from exc
        latency_ms = int((time.monotonic() - started) * 1000)

        if response.status_code >= 400:
            raise ProviderResponseError(
                f"Ollama returned status {response.status_code}: {response.text}"
            )

        try:
            data = response.json()
            text = data["response"]
        except (ValueError, KeyError, TypeError) as exc:
            raise ProviderResponseError("Ollama returned an unparseable response") from exc

        return GenerationResult(
            text=text,
            provider="ollama",
            model=data.get("model", self._model),
            latency_ms=latency_ms,
        )
