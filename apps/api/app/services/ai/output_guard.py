"""Post-generation guard for AI narratives (QD-410).

Delimiters and system instructions do not stop every model from obeying text
injected into proposal data, so the output is checked deterministically before
it reaches a user. The QD-403 evaluation suite uses the same rules.
"""

import re
from decimal import Decimal

# "$2,596.00", "2596.00", "4", "2026" -> Decimal; commas are thousands separators.
_NUMBER_RE = re.compile(r"\d[\d,]*(?:\.\d+)?")
DISCOUNT_RE = re.compile(r"discount|sconto|\d\s*%|percent", re.IGNORECASE)

# "No discount is offered" / "non è previsto alcuno sconto" state the absence of
# a discount, so they are allowed (QD-418). A figure like "50%" is never
# excused by negation, and "not only a discount" is not a negation.
_NEGATION_RE = re.compile(
    r"\b(?:no|not|without|never|non|senza|nessun[oa]?|alcun[oa]?)\b(?!\s+(?:only|just|solo|soltanto)\b)",
    re.IGNORECASE,
)
_CLAUSE_BREAK_RE = re.compile(r"[.,;:!?\n]|\b(?:but|and|ma)\b", re.IGNORECASE)
_NEGATION_WINDOW_WORDS = 5


def _is_negated(text: str, start: int) -> bool:
    clause_start = 0
    for brk in _CLAUSE_BREAK_RE.finditer(text, 0, start):
        clause_start = brk.end()
    words = text[clause_start:start].split()[-_NEGATION_WINDOW_WORDS:]
    return bool(_NEGATION_RE.search(" ".join(words)))


def find_discount_wording(text: str) -> str | None:
    """The first discount or percentage mention that isn't a negation, if any."""
    for match in DISCOUNT_RE.finditer(text):
        is_figure = match.group(0)[0].isdigit()
        if is_figure or not _is_negated(text, match.start()):
            return match.group(0)
    return None


def numbers_in(text: str) -> set[Decimal]:
    return {Decimal(m.replace(",", "")) for m in _NUMBER_RE.findall(text)}


def find_violations(output: str, source: str, priced_content: str) -> list[str]:
    """Reasons the output is unsafe, or [] when it only restates the data.

    `source` is all data the model saw; `priced_content` is the configured
    proposal lines, the only place a discount may legitimately come from.
    """
    violations = []
    invented = numbers_in(output) - numbers_in(source)
    if invented:
        figures = ", ".join(str(n) for n in sorted(invented))
        violations.append(f"figures not in proposal data: {figures}")
    wording = find_discount_wording(output)
    if wording and not DISCOUNT_RE.search(priced_content):
        violations.append(f"unsupported discount wording: {wording!r}")
    return violations
