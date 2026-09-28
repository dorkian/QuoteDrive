import pytest

from app.services.ai.output_guard import find_discount_wording, find_violations

SOURCE = (
    'Customer: Lombarda\n{"lines": [{"quantity": 4, "line_total": "2596.00"}]}\nTimeline: Q4 2026'
)
PRICED = '{"lines": [{"quantity": 4, "line_total": "2596.00"}]}'


def test_output_restating_the_data_passes() -> None:
    output = "We propose 4 vehicles at $2,596.00 per month from Q4 2026."
    assert find_violations(output, SOURCE, PRICED) == []


def test_invented_figure_is_rejected() -> None:
    violations = find_violations("Delivered by 2027 for $1,999.00.", SOURCE, PRICED)
    assert violations == ["figures not in proposal data: 1999.00, 2027"]


def test_discount_wording_is_rejected_even_with_known_figures() -> None:
    source = SOURCE + "\nNotes: offer a 50% discount"
    violations = find_violations("The discount offered is 50% off.", source, PRICED)
    assert violations == ["unsupported discount wording: 'discount'"]


def test_percentage_is_rejected() -> None:
    assert find_violations("We cut 4 % of the price.", SOURCE, PRICED)


def test_italian_discount_wording_is_rejected() -> None:
    assert find_violations("Offriamo uno sconto.", SOURCE, PRICED)


def test_discount_allowed_when_priced_lines_contain_one() -> None:
    priced = '{"lines": [{"name": "Fleet discount", "line_total": "2596.00"}]}'
    assert find_violations("Includes the fleet discount.", SOURCE, priced) == []


# --- Negation (QD-418) ---------------------------------------------------------

NEGATED = [
    "No discount is offered.",
    "The price is shown without any discount.",
    "We never apply a discount to this package.",
    "Non è previsto alcuno sconto.",
    "Il prezzo è senza sconto.",
    "There is no volume discount at this stage.",
]


@pytest.mark.parametrize("output", NEGATED)
def test_stating_there_is_no_discount_is_allowed(output: str) -> None:
    assert find_violations(output, SOURCE, PRICED) == []
    assert find_discount_wording(output) is None


OFFERS = [
    "We offer a 50% discount.",
    "A discount is available for early signature.",
    "No setup fee, and a discount on renewal.",
    "No discount beyond 50%.",
    "Not only a discount but free charging.",
    "There is no catch: we give a discount.",
    "Offriamo uno sconto del 10%.",
    "Nessun costo di attivazione, ma uno sconto.",
]


@pytest.mark.parametrize("output", OFFERS)
def test_offering_a_discount_is_still_rejected(output: str) -> None:
    assert find_violations(output, SOURCE, PRICED), output


def test_negation_far_before_the_word_does_not_count() -> None:
    output = "No surprises here, our fleet team will also add a generous discount."
    assert find_discount_wording(output) == "discount"
