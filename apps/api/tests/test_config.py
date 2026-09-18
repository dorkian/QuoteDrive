import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_invalid_config_raises_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("POSTGRES_PORT", "invalid-port")

    with pytest.raises(ValidationError):
        Settings()
