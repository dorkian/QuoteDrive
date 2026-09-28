"""Retry and fallback behaviour (QD-417, ADR-005)."""

import httpx
import pytest

from app.core.config import Settings
from app.services.ai.providers import (
    FallbackProvider,
    get_provider,
)
from app.services.ai.providers.base import (
    GenerationProvider,
    GenerationRequest,
    GenerationResult,
    ProviderAuthenticationError,
    ProviderError,
    ProviderResponseError,
    ProviderTimeoutError,
    ProviderTransientError,
)
from app.services.ai.providers.fake import FakeProvider
from app.services.ai.providers.fallback import FallbackProvider as _Fallback
from app.services.ai.providers.ollama import OllamaProvider
from app.services.ai.providers.openrouter import OpenRouterProvider

REQUEST = GenerationRequest(prompt="hi")


class ScriptedProvider(GenerationProvider):
    """Raises or answers in order, one step per call."""

    def __init__(self, name: str, steps: list[ProviderError | str]) -> None:
        self._name = name
        self._steps = list(steps)
        self.calls = 0

    @property
    def name(self) -> str:
        return self._name

    @property
    def model(self) -> str:
        return f"{self._name}-model"

    def generate(self, request: GenerationRequest) -> GenerationResult:
        self.calls += 1
        step = self._steps.pop(0)
        if isinstance(step, ProviderError):
            raise step
        return GenerationResult(text=step, provider=self._name, model=self.model, latency_ms=1)


def _wrap(
    primary: GenerationProvider, fallback: GenerationProvider | None
) -> tuple[FallbackProvider, list[float]]:
    sleeps: list[float] = []
    return _Fallback(primary, fallback, retry_backoff_seconds=0.5, sleep=sleeps.append), sleeps


def test_success_needs_no_retry() -> None:
    primary = ScriptedProvider("openrouter", ["ok"])
    provider, sleeps = _wrap(primary, None)

    result = provider.generate(REQUEST)

    assert result.text == "ok"
    assert result.fallback_reason is None
    assert (primary.calls, sleeps) == (1, [])


@pytest.mark.parametrize("error", [ProviderTimeoutError("t"), ProviderTransientError("503")])
def test_one_transient_failure_is_retried_once(error: ProviderError) -> None:
    primary = ScriptedProvider("openrouter", [error, "second try"])
    fallback = ScriptedProvider("ollama", ["unused"])
    provider, sleeps = _wrap(primary, fallback)

    result = provider.generate(REQUEST)

    assert result.text == "second try"
    assert result.fallback_reason is None
    assert provider.fallback_reason is None
    assert (primary.calls, fallback.calls, sleeps) == (2, 0, [0.5])


@pytest.mark.parametrize(
    ("error", "reason"),
    [
        (ProviderTimeoutError("t"), "openrouter timeout"),
        (ProviderTransientError("503"), "openrouter unavailable"),
    ],
)
def test_second_transient_failure_falls_back(error: ProviderError, reason: str) -> None:
    primary = ScriptedProvider("openrouter", [error, error])
    fallback = ScriptedProvider("ollama", ["local draft"])
    provider, _ = _wrap(primary, fallback)

    result = provider.generate(REQUEST)

    assert (result.text, result.provider, result.model) == ("local draft", "ollama", "ollama-model")
    assert result.fallback_reason == reason
    assert provider.fallback_reason == reason
    assert (primary.calls, fallback.calls) == (2, 1)


@pytest.mark.parametrize(
    "error",
    [
        ProviderAuthenticationError("bad key"),
        ProviderResponseError("400 bad request"),
        ProviderResponseError("unparseable"),
    ],
)
def test_non_transient_failures_never_retry_or_fall_back(error: ProviderError) -> None:
    primary = ScriptedProvider("openrouter", [error])
    fallback = ScriptedProvider("ollama", ["unused"])
    provider, sleeps = _wrap(primary, fallback)

    with pytest.raises(type(error)):
        provider.generate(REQUEST)

    assert (primary.calls, fallback.calls, sleeps) == (1, 0, [])
    assert provider.fallback_reason is None


def test_without_a_fallback_the_retry_error_is_raised() -> None:
    primary = ScriptedProvider(
        "openrouter", [ProviderTimeoutError("t1"), ProviderTimeoutError("t2")]
    )
    provider, _ = _wrap(primary, None)

    with pytest.raises(ProviderTimeoutError, match="t2"):
        provider.generate(REQUEST)

    assert provider.fallback_reason is None


def test_failed_fallback_reports_the_primary_error() -> None:
    primary = ScriptedProvider(
        "openrouter", [ProviderTimeoutError("t1"), ProviderTimeoutError("t2")]
    )
    fallback = ScriptedProvider("ollama", [ProviderTransientError("ollama down")])
    provider, _ = _wrap(primary, fallback)

    with pytest.raises(ProviderTimeoutError) as exc_info:
        provider.generate(REQUEST)

    assert isinstance(exc_info.value.__cause__, ProviderTransientError)
    assert provider.fallback_reason == "openrouter timeout"


def test_fallback_reason_resets_between_calls() -> None:
    primary = ScriptedProvider(
        "openrouter", [ProviderTimeoutError("t"), ProviderTimeoutError("t"), "fine"]
    )
    fallback = ScriptedProvider("ollama", ["local"])
    provider, _ = _wrap(primary, fallback)
    provider.generate(REQUEST)

    result = provider.generate(REQUEST)

    assert result.fallback_reason is None
    assert provider.fallback_reason is None


def test_close_closes_both_providers() -> None:
    closed: list[str] = []

    class Closing(ScriptedProvider):
        def close(self) -> None:
            closed.append(self.name)

    provider, _ = _wrap(Closing("openrouter", []), Closing("ollama", []))
    provider.close()

    assert closed == ["openrouter", "ollama"]


# --- Classifying real HTTP failures -------------------------------------------------


def _openrouter(status: int) -> OpenRouterProvider:
    return OpenRouterProvider(
        api_key="k",
        model="m",
        timeout_seconds=1.0,
        transport=httpx.MockTransport(lambda _: httpx.Response(status, text="x")),
    )


@pytest.mark.parametrize("status", [429, 500, 502, 503])
def test_openrouter_5xx_and_429_are_transient(status: int) -> None:
    with pytest.raises(ProviderTransientError):
        _openrouter(status).generate(REQUEST)


@pytest.mark.parametrize("status", [400, 404, 422])
def test_openrouter_other_4xx_are_not_transient(status: int) -> None:
    with pytest.raises(ProviderResponseError) as exc_info:
        _openrouter(status).generate(REQUEST)
    assert not isinstance(exc_info.value, ProviderTransientError)


def test_connection_errors_are_transient() -> None:
    def refuse(_: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("refused")

    provider = OllamaProvider(
        base_url="http://localhost:1",
        model="m",
        timeout_seconds=1.0,
        transport=httpx.MockTransport(refuse),
    )

    with pytest.raises(ProviderTransientError):
        provider.generate(REQUEST)


def test_ollama_503_is_transient() -> None:
    provider = OllamaProvider(
        base_url="http://localhost:1",
        model="m",
        timeout_seconds=1.0,
        transport=httpx.MockTransport(lambda _: httpx.Response(503, text="busy")),
    )

    with pytest.raises(ProviderTransientError):
        provider.generate(REQUEST)


# --- Factory ------------------------------------------------------------------------


def _settings(fallback: str = "ollama") -> Settings:
    return Settings(
        AI_PROVIDER="openrouter",
        OPENROUTER_API_KEY="k",
        AI_FALLBACK_PROVIDER=fallback,  # type: ignore[arg-type]
    )


def test_factory_adds_fallback_only_when_tenant_allows_it() -> None:
    allowed = get_provider(_settings(), allow_fallback=True)
    blocked = get_provider(_settings(), allow_fallback=False)

    assert isinstance(allowed, FallbackProvider)
    assert isinstance(allowed._fallback, OllamaProvider)
    assert isinstance(blocked, FallbackProvider)
    assert blocked._fallback is None


def test_factory_has_no_fallback_when_the_deployment_has_none() -> None:
    provider = get_provider(_settings(fallback=""), allow_fallback=True)

    assert isinstance(provider, FallbackProvider)
    assert provider._fallback is None


def test_fake_provider_is_not_wrapped() -> None:
    assert isinstance(get_provider(Settings(AI_PROVIDER="fake"), allow_fallback=True), FakeProvider)
