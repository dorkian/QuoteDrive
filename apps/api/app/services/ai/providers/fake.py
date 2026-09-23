from app.services.ai.providers.base import GenerationProvider, GenerationRequest, GenerationResult

DEFAULT_FIXTURE_TEXT = "This is a deterministic fixture response from FakeProvider."


class FakeProvider(GenerationProvider):
    """No-network provider for automated AI tests (see AGENTS.md)."""

    def __init__(self, fixture_text: str = DEFAULT_FIXTURE_TEXT, model: str = "fake-model") -> None:
        self._fixture_text = fixture_text
        self._model = model

    def generate(self, request: GenerationRequest) -> GenerationResult:
        return GenerationResult(
            text=self._fixture_text,
            provider="fake",
            model=self._model,
            latency_ms=0,
        )
