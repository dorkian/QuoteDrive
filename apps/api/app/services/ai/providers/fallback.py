import time
from collections.abc import Callable
from dataclasses import replace

from app.services.ai.providers.base import (
    GenerationProvider,
    GenerationRequest,
    GenerationResult,
    ProviderError,
    ProviderTimeoutError,
    ProviderTransientError,
)

_TRANSIENT = (ProviderTimeoutError, ProviderTransientError)


def _describe(provider: GenerationProvider, error: ProviderError) -> str:
    kind = "timeout" if isinstance(error, ProviderTimeoutError) else "unavailable"
    return f"{provider.name} {kind}"


class FallbackProvider(GenerationProvider):
    """Retry the primary once on a transient failure, then use the fallback.

    ADR-005 / NFR Reliability. Only availability problems (timeout, connection
    error, 5xx, 429) retry or fall back. Credentials, other 4xx responses and
    unusable output never do: another attempt wouldn't fix them, and schema or
    output-guard failures are checked by the caller after generation anyway.
    """

    def __init__(
        self,
        primary: GenerationProvider,
        fallback: GenerationProvider | None = None,
        *,
        retry_backoff_seconds: float = 1.0,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._primary = primary
        self._fallback = fallback
        self._backoff = retry_backoff_seconds
        self._sleep = sleep
        self._fallback_reason: str | None = None

    @property
    def name(self) -> str:
        return self._primary.name

    @property
    def model(self) -> str:
        return self._primary.model

    @property
    def fallback_reason(self) -> str | None:
        return self._fallback_reason

    def generate(self, request: GenerationRequest) -> GenerationResult:
        self._fallback_reason = None
        try:
            return self._primary.generate(request)
        except _TRANSIENT:
            pass

        self._sleep(self._backoff)
        try:
            return self._primary.generate(request)
        except _TRANSIENT as retry_error:
            if self._fallback is None:
                raise
            reason = _describe(self._primary, retry_error)
            self._fallback_reason = reason
            try:
                result = self._fallback.generate(request)
            except ProviderError as fallback_error:
                # Report the primary's failure: that's what the operator must
                # fix. The fallback's own error is chained for the log.
                raise retry_error from fallback_error
            return replace(result, fallback_reason=reason)

    def close(self) -> None:
        self._primary.close()
        if self._fallback is not None:
            self._fallback.close()
