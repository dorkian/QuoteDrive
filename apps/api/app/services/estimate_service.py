from collections.abc import Iterable
from decimal import Decimal

ILLUSTRATIVE_DISCLAIMER = "Illustrative planning estimate only."


def calculate_line_total(
    base_monthly_estimate: Decimal, add_on_total: Decimal, quantity: int
) -> Decimal:
    return (base_monthly_estimate + add_on_total) * quantity


def calculate_proposal_total(line_totals: Iterable[Decimal]) -> Decimal:
    return sum(line_totals, start=Decimal("0"))

