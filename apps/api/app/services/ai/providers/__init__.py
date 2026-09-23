from app.core.config import Settings
from app.services.ai.providers.base import (
    GenerationProvider,
    GenerationRequest,
    GenerationResult,
    ProviderAuthenticationError,
    ProviderError,
    ProviderResponseError,
    ProviderTimeoutError,
)
from app.services.ai.providers.fake import FakeProvider
from app.services.ai.providers.ollama import OllamaProvider
from app.services.ai.providers.openrouter import OpenRouterProvider

__all__ = [
    "FakeProvider",
    "GenerationProvider",
    "GenerationRequest",
    "GenerationResult",
    "OllamaProvider",
    "OpenRouterProvider",
    "ProviderAuthenticationError",
    "ProviderError",
    "ProviderResponseError",
    "ProviderTimeoutError",
    "get_provider",
]


def get_provider(settings: Settings) -> GenerationProvider:
    if settings.AI_PROVIDER == "fake":
        return FakeProvider()
    if settings.AI_PROVIDER == "openrouter":
        if not settings.OPENROUTER_API_KEY:
            raise ValueError("AI_PROVIDER is 'openrouter' but OPENROUTER_API_KEY is not configured")
        return OpenRouterProvider(
            api_key=settings.OPENROUTER_API_KEY,
            model=settings.OPENROUTER_MODEL,
            timeout_seconds=settings.AI_REQUEST_TIMEOUT_SECONDS,
        )
    if settings.AI_PROVIDER == "ollama":
        return OllamaProvider(
            base_url=settings.OLLAMA_BASE_URL,
            model=settings.OLLAMA_MODEL,
            timeout_seconds=settings.AI_REQUEST_TIMEOUT_SECONDS,
        )
    raise ValueError(f"Unknown AI_PROVIDER: {settings.AI_PROVIDER!r}")
