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
    @property
    @abstractmethod
    def name(self) -> str:
        """Short provider identifier (e.g. "openrouter"), known before any call succeeds —
        lets a caller log which provider/model an attempt used even if it fails."""

    @property
    @abstractmethod
    def model(self) -> str:
        """The configured model identifier, known before any call succeeds."""

    @abstractmethod
    def generate(self, request: GenerationRequest) -> GenerationResult: ...

    def close(self) -> None:
        """Release any held resources (e.g. an HTTP connection pool). No-op by default."""
