from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass(frozen=True)
class GenerationRequest:
    prompt: str
    system: str | None = None
    max_tokens: int | None = None
    temperature: float | None = None


@dataclass(frozen=True)
class GenerationResult:
    text: str
    provider: str
    model: str
    latency_ms: int


class ProviderError(Exception):
    """Base class for all provider call failures."""


class ProviderAuthenticationError(ProviderError):
    """The provider rejected the request's credentials."""


class ProviderTimeoutError(ProviderError):
    """The provider did not respond within the configured timeout."""


class ProviderResponseError(ProviderError):
    """The provider returned a non-2xx status or an unparseable response."""


class GenerationProvider(ABC):
    @abstractmethod
    def generate(self, request: GenerationRequest) -> GenerationResult: ...
