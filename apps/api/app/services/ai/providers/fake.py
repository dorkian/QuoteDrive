from app.services.ai.providers.base import (
    GenerationProvider,
    GenerationRequest,
    GenerationResult,
    ProviderError,
)

DEFAULT_FIXTURE_TEXT = "This is a deterministic fixture response from FakeProvider."


class FakeProvider(GenerationProvider):
    """No-network provider for automated AI tests (see AGENTS.md).

    Pass `raise_error` to simulate a provider-call failure (auth/timeout/response
    error) instead of hand-rolling a bespoke stub provider per test.
    """

    def __init__(
        self,
        fixture_text: str = DEFAULT_FIXTURE_TEXT,
        model: str = "fake-model",
        raise_error: ProviderError | None = None,
    ) -> None:
        self._fixture_text = fixture_text
        self._model = model
        self._raise_error = raise_error

    @property
    def name(self) -> str:
        return "fake"

    @property
    def model(self) -> str:
        return self._model

    def generate(self, request: GenerationRequest) -> GenerationResult:
        if self._raise_error is not None:
            raise self._raise_error
        return GenerationResult(
            text=self._fixture_text,
            provider="fake",
            model=self._model,
            latency_ms=0,
        )
