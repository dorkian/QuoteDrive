"""Unit tests for deterministic illustrative estimate service (ADR-003)."""

from decimal import Decimal

from app.services.estimate_service import (
    ILLUSTRATIVE_DISCLAIMER,
    calculate_line_total,
    calculate_proposal_total,
)


def test_calculate_line_total_with_add_ons() -> None:
    # 649.00 package + 89.00 maintenance = 738.00 unit estimate * 4 vehicles = 2952.00
    base = Decimal("649.00")
    add_ons = Decimal("89.00")
    quantity = 4

    total = calculate_line_total(base, add_ons, quantity)
    assert total == Decimal("2952.00")


def test_calculate_line_total_zero_quantity() -> None:
    # quantity=0 yields 0 with no error
    base = Decimal("649.00")
    add_ons = Decimal("89.00")
    quantity = 0

    total = calculate_line_total(base, add_ons, quantity)
    assert total == Decimal("0")


def test_calculate_line_total_without_add_ons() -> None:
    base = Decimal("549.00")
    add_ons = Decimal("0")
    quantity = 5

    total = calculate_line_total(base, add_ons, quantity)
    assert total == Decimal("2745.00")


def test_calculate_proposal_total_empty() -> None:
    total = calculate_proposal_total([])
    assert total == Decimal("0")


def test_calculate_proposal_total_multiple_lines() -> None:
    lines = [
        Decimal("2952.00"),
        Decimal("2745.00"),
        Decimal("2244.00"),
    ]
    total = calculate_proposal_total(lines)
    assert total == Decimal("7941.00")


def test_decimal_precision_preserves_exact_values() -> None:
    base = Decimal("100.33")
    add_ons = Decimal("50.67")
    total = calculate_line_total(base, add_ons, 3)
    assert total == Decimal("453.00")


def test_illustrative_disclaimer_text() -> None:
    assert ILLUSTRATIVE_DISCLAIMER == "Illustrative planning estimate only."

