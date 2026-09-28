from app.core.config import Settings
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
from app.services.ai.providers.fallback import FallbackProvider
from app.services.ai.providers.ollama import OllamaProvider
from app.services.ai.providers.openrouter import OpenRouterProvider

__all__ = [
    "FakeProvider",
    "FallbackProvider",
    "GenerationProvider",
    "GenerationRequest",
    "GenerationResult",
    "OllamaProvider",
    "OpenRouterProvider",
    "ProviderAuthenticationError",
    "ProviderError",
    "ProviderResponseError",
    "ProviderTimeoutError",
    "ProviderTransientError",
    "get_provider",
]


def _build(settings: Settings, name: str) -> GenerationProvider:
    if name == "fake":
        return FakeProvider()
    if name == "openrouter":
        if not settings.OPENROUTER_API_KEY:
            raise ValueError("AI_PROVIDER is 'openrouter' but OPENROUTER_API_KEY is not configured")
        return OpenRouterProvider(
            api_key=settings.OPENROUTER_API_KEY,
            model=settings.OPENROUTER_MODEL,
            timeout_seconds=settings.AI_REQUEST_TIMEOUT_SECONDS,
        )
    if name == "ollama":
        return OllamaProvider(
            base_url=settings.OLLAMA_BASE_URL,
            model=settings.OLLAMA_MODEL,
            timeout_seconds=settings.AI_REQUEST_TIMEOUT_SECONDS,
        )
    raise ValueError(f"Unknown AI_PROVIDER: {name!r}")


def fallback_available(settings: Settings) -> bool:
    """Whether this deployment has a fallback a tenant could opt into."""
    return settings.AI_PROVIDER == "openrouter" and settings.AI_FALLBACK_PROVIDER == "ollama"


def get_provider(settings: Settings, *, allow_fallback: bool = False) -> GenerationProvider:
    primary = _build(settings, settings.AI_PROVIDER)
    if settings.AI_PROVIDER == "fake":
        return primary
    fallback = (
        _build(settings, settings.AI_FALLBACK_PROVIDER)
        if allow_fallback and fallback_available(settings)
        else None
    )
    return FallbackProvider(
        primary, fallback, retry_backoff_seconds=settings.AI_RETRY_BACKOFF_SECONDS
    )
