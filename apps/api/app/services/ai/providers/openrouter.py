import time

import httpx

from app.services.ai.providers.base import (
    GenerationProvider,
    GenerationRequest,
    GenerationResult,
    ProviderAuthenticationError,
    ProviderResponseError,
    ProviderTimeoutError,
)

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


class OpenRouterProvider(GenerationProvider):
    def __init__(
        self,
        api_key: str,
        model: str,
        timeout_seconds: float,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self._api_key = api_key
        self._model = model
        self._client = httpx.Client(transport=transport, timeout=timeout_seconds)

    def generate(self, request: GenerationRequest) -> GenerationResult:
        messages = []
        if request.system:
            messages.append({"role": "system", "content": request.system})
        messages.append({"role": "user", "content": request.prompt})

        body: dict[str, object] = {"model": self._model, "messages": messages}
        if request.max_tokens is not None:
            body["max_tokens"] = request.max_tokens
        if request.temperature is not None:
            body["temperature"] = request.temperature

        started = time.monotonic()
        try:
            response = self._client.post(
                OPENROUTER_URL,
                json=body,
                headers={"Authorization": f"Bearer {self._api_key}"},
            )
        except httpx.TimeoutException as exc:
            raise ProviderTimeoutError("OpenRouter request timed out") from exc
        except httpx.HTTPError as exc:
            raise ProviderResponseError(f"OpenRouter request failed: {exc}") from exc
        latency_ms = int((time.monotonic() - started) * 1000)

        if response.status_code in (401, 403):
            raise ProviderAuthenticationError("OpenRouter rejected the configured API key")
        if response.status_code >= 400:
            raise ProviderResponseError(
                f"OpenRouter returned status {response.status_code}: {response.text}"
            )

        try:
            data = response.json()
            text = data["choices"][0]["message"]["content"]
        except (ValueError, KeyError, IndexError, TypeError) as exc:
            raise ProviderResponseError("OpenRouter returned an unparseable response") from exc

        return GenerationResult(
            text=text,
            provider="openrouter",
            model=data.get("model", self._model),
            latency_ms=latency_ms,
        )
