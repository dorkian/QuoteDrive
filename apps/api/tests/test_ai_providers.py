import json
from typing import Any

import httpx
import pytest

from app.core.config import Settings
from app.services.ai.providers import FallbackProvider, get_provider
from app.services.ai.providers.base import (
    GenerationRequest,
    ProviderAuthenticationError,
    ProviderResponseError,
    ProviderTimeoutError,
)
from app.services.ai.providers.fake import DEFAULT_FIXTURE_TEXT, FakeProvider
from app.services.ai.providers.ollama import OllamaProvider
from app.services.ai.providers.openrouter import OpenRouterProvider


def test_fake_provider_returns_deterministic_fixture() -> None:
    provider = FakeProvider()

    result = provider.generate(GenerationRequest(prompt="draft a summary"))

    assert result.text == DEFAULT_FIXTURE_TEXT
    assert result.provider == "fake"
    assert result.latency_ms == 0


def test_fake_provider_uses_custom_fixture() -> None:
    provider = FakeProvider(fixture_text="custom output", model="fake-v2")

    result = provider.generate(GenerationRequest(prompt="anything"))

    assert result.text == "custom output"
    assert result.model == "fake-v2"


def test_openrouter_provider_parses_successful_response() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["authorization"] == "Bearer test-key"
        return httpx.Response(
            200,
            json={
                "model": "openai/gpt-4o-mini",
                "choices": [{"message": {"content": "Generated narrative text"}}],
            },
        )

    provider = OpenRouterProvider(
        api_key="test-key",
        model="openai/gpt-4o-mini",
        timeout_seconds=5.0,
        transport=httpx.MockTransport(handler),
    )

    result = provider.generate(GenerationRequest(prompt="draft a proposal"))

    assert result.text == "Generated narrative text"
    assert result.provider == "openrouter"
    assert result.model == "openai/gpt-4o-mini"
    assert result.latency_ms >= 0


def test_openrouter_provider_raises_authentication_error_on_401() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"error": "invalid api key"})

    provider = OpenRouterProvider(
        api_key="bad-key",
        model="openai/gpt-4o-mini",
        timeout_seconds=5.0,
        transport=httpx.MockTransport(handler),
    )

    with pytest.raises(ProviderAuthenticationError):
        provider.generate(GenerationRequest(prompt="draft a proposal"))


def test_openrouter_provider_raises_timeout_error() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("timed out", request=request)

    provider = OpenRouterProvider(
        api_key="test-key",
        model="openai/gpt-4o-mini",
        timeout_seconds=5.0,
        transport=httpx.MockTransport(handler),
    )

    with pytest.raises(ProviderTimeoutError):
        provider.generate(GenerationRequest(prompt="draft a proposal"))


def test_openrouter_provider_raises_response_error_on_malformed_body() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"unexpected": "shape"})

    provider = OpenRouterProvider(
        api_key="test-key",
        model="openai/gpt-4o-mini",
        timeout_seconds=5.0,
        transport=httpx.MockTransport(handler),
    )

    with pytest.raises(ProviderResponseError):
        provider.generate(GenerationRequest(prompt="draft a proposal"))


def test_openrouter_provider_raises_authentication_error_on_403() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(403, json={"error": "forbidden"})

    provider = OpenRouterProvider(
        api_key="bad-key",
        model="openai/gpt-4o-mini",
        timeout_seconds=5.0,
        transport=httpx.MockTransport(handler),
    )

    with pytest.raises(ProviderAuthenticationError):
        provider.generate(GenerationRequest(prompt="draft a proposal"))


def test_openrouter_provider_raises_response_error_on_null_content() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"choices": [{"message": {"content": None}}]})

    provider = OpenRouterProvider(
        api_key="test-key",
        model="openai/gpt-4o-mini",
        timeout_seconds=5.0,
        transport=httpx.MockTransport(handler),
    )

    with pytest.raises(ProviderResponseError, match="non-string or empty message content"):
        provider.generate(GenerationRequest(prompt="draft a proposal"))


def test_openrouter_provider_truncates_large_error_body() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(502, text="<html>" + "x" * 5000 + "</html>")

    provider = OpenRouterProvider(
        api_key="test-key",
        model="openai/gpt-4o-mini",
        timeout_seconds=5.0,
        transport=httpx.MockTransport(handler),
    )

    with pytest.raises(ProviderResponseError) as exc_info:
        provider.generate(GenerationRequest(prompt="draft a proposal"))
    assert len(str(exc_info.value)) < 400


def test_openrouter_provider_sends_system_message_and_sampling_params() -> None:
    captured: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured.update(json.loads(request.content))
        return httpx.Response(200, json={"choices": [{"message": {"content": "ok"}}], "model": "m"})

    provider = OpenRouterProvider(
        api_key="test-key",
        model="openai/gpt-4o-mini",
        timeout_seconds=5.0,
        transport=httpx.MockTransport(handler),
    )

    provider.generate(
        GenerationRequest(
            prompt="draft a proposal", system="be concise", max_tokens=256, temperature=0.2
        )
    )

    assert captured["messages"][0] == {"role": "system", "content": "be concise"}
    assert captured["messages"][1] == {"role": "user", "content": "draft a proposal"}
    assert captured["max_tokens"] == 256
    assert captured["temperature"] == 0.2


def test_openrouter_provider_close_closes_client() -> None:
    provider = OpenRouterProvider(api_key="key", model="m", timeout_seconds=5.0)

    provider.close()

    assert provider._client.is_closed


def test_ollama_provider_parses_successful_response() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/generate"
        return httpx.Response(200, json={"model": "llama3", "response": "Local draft text"})

    provider = OllamaProvider(
        base_url="http://localhost:11434",
        model="llama3",
        timeout_seconds=5.0,
        transport=httpx.MockTransport(handler),
    )

    result = provider.generate(GenerationRequest(prompt="draft a proposal"))

    assert result.text == "Local draft text"
    assert result.provider == "ollama"
    assert result.model == "llama3"


def test_ollama_provider_raises_response_error_on_failure_status() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, text="internal error")

    provider = OllamaProvider(
        base_url="http://localhost:11434",
        model="llama3",
        timeout_seconds=5.0,
        transport=httpx.MockTransport(handler),
    )

    with pytest.raises(ProviderResponseError):
        provider.generate(GenerationRequest(prompt="draft a proposal"))


def test_ollama_provider_truncates_large_error_body() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(502, text="<html>" + "x" * 5000 + "</html>")

    provider = OllamaProvider(
        base_url="http://localhost:11434",
        model="llama3",
        timeout_seconds=5.0,
        transport=httpx.MockTransport(handler),
    )

    with pytest.raises(ProviderResponseError) as exc_info:
        provider.generate(GenerationRequest(prompt="draft a proposal"))
    assert len(str(exc_info.value)) < 400


def test_ollama_provider_raises_response_error_on_malformed_body() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"unexpected": "shape"})

    provider = OllamaProvider(
        base_url="http://localhost:11434",
        model="llama3",
        timeout_seconds=5.0,
        transport=httpx.MockTransport(handler),
    )

    with pytest.raises(ProviderResponseError):
        provider.generate(GenerationRequest(prompt="draft a proposal"))


def test_ollama_provider_raises_response_error_on_null_content() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"model": "llama3", "response": None})

    provider = OllamaProvider(
        base_url="http://localhost:11434",
        model="llama3",
        timeout_seconds=5.0,
        transport=httpx.MockTransport(handler),
    )

    with pytest.raises(ProviderResponseError, match="non-string or empty response content"):
        provider.generate(GenerationRequest(prompt="draft a proposal"))


def test_ollama_provider_raises_timeout_error() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("timed out", request=request)

    provider = OllamaProvider(
        base_url="http://localhost:11434",
        model="llama3",
        timeout_seconds=5.0,
        transport=httpx.MockTransport(handler),
    )

    with pytest.raises(ProviderTimeoutError):
        provider.generate(GenerationRequest(prompt="draft a proposal"))


def test_ollama_provider_sends_system_prompt_and_sampling_options() -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured.update(json.loads(request.content))
        return httpx.Response(200, json={"model": "llama3", "response": "ok"})

    provider = OllamaProvider(
        base_url="http://localhost:11434",
        model="llama3",
        timeout_seconds=5.0,
        transport=httpx.MockTransport(handler),
    )

    provider.generate(
        GenerationRequest(
            prompt="draft a proposal", system="be concise", max_tokens=256, temperature=0.2
        )
    )

    assert captured["system"] == "be concise"
    assert captured["options"] == {"num_predict": 256, "temperature": 0.2}


def test_ollama_provider_close_closes_client() -> None:
    provider = OllamaProvider(
        base_url="http://localhost:11434", model="llama3", timeout_seconds=5.0
    )

    provider.close()

    assert provider._client.is_closed


def test_get_provider_returns_fake_by_default() -> None:
    provider = get_provider(Settings(AI_PROVIDER="fake"))

    assert isinstance(provider, FakeProvider)


def test_get_provider_returns_ollama_provider() -> None:
    provider = get_provider(Settings(AI_PROVIDER="ollama", OLLAMA_MODEL="llama3"))

    # Real providers are wrapped for the retry (ADR-005).
    assert isinstance(provider, FallbackProvider)
    assert (provider.name, provider.model) == ("ollama", "llama3")


def test_get_provider_requires_api_key_for_openrouter() -> None:
    with pytest.raises(ValueError, match="OPENROUTER_API_KEY"):
        get_provider(Settings(AI_PROVIDER="openrouter", OPENROUTER_API_KEY=None))


def test_get_provider_returns_openrouter_provider_when_key_present() -> None:
    provider = get_provider(Settings(AI_PROVIDER="openrouter", OPENROUTER_API_KEY="key-123"))

    assert isinstance(provider, FallbackProvider)
    assert provider.name == "openrouter"
