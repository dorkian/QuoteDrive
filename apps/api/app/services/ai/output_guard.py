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
    match = DISCOUNT_RE.search(output)
    if match and not DISCOUNT_RE.search(priced_content):
        violations.append(f"unsupported discount wording: {match.group(0)!r}")
    return violations
