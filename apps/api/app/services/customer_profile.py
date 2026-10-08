"""Customer profile rules shared by the API and the AI prompts."""

import re
from typing import Any

# Stored keys are stable; the labels are what people (and the drafting prompt) read.
COMPANY_SIZES: dict[str, str] = {
    "1-50": "Small team (1-50 employees)",
    "51-200": "Growing company (51-200 employees)",
    "201-1000": "Mid-size company (201-1000 employees)",
    "1000+": "Large enterprise (1000+ employees)",
}

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_SCHEME_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9+.-]*://")

MAX_TAGS = 6
MAX_TAG_LENGTH = 40
MAX_ABOUT_LENGTH = 600


def clean_text(value: str | None) -> str | None:
    """Trim; an empty string means "not set"."""
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


def clean_website(value: str | None) -> str | None:
    """Accept "acme.example" or a full URL; only http(s) is allowed."""
    text = clean_text(value)
    if text is None:
        return None
    if not _SCHEME_RE.match(text):
        text = f"https://{text}"
    if not text.lower().startswith(("http://", "https://")):
        raise ValueError("Website must start with http:// or https://")
    if " " in text or "." not in text.split("://", 1)[1]:
        raise ValueError("Enter a valid website address")
    return text


def clean_email(value: str | None) -> str | None:
    text = clean_text(value)
    if text is None:
        return None
    if not _EMAIL_RE.match(text):
        raise ValueError("Enter a valid email address")
    return text


def clean_tags(values: list[str] | None) -> list[str] | None:
    if values is None:
        return None
    seen: dict[str, str] = {}
    for raw in values:
        tag = raw.strip()
        if not tag:
            continue
        if len(tag) > MAX_TAG_LENGTH:
            raise ValueError(f"Each tag can be up to {MAX_TAG_LENGTH} characters")
        seen.setdefault(tag.lower(), tag)
    tags = list(seen.values())
    if len(tags) > MAX_TAGS:
        raise ValueError(f"Add up to {MAX_TAGS} tags")
    return tags or None


def profile_lines(customer: Any) -> list[str]:
    """Customer facts for an AI prompt, one `Label: value` per line; only what is set.

    These go inside the prompt's untrusted-data block. Company size is spelled out
    with its employee range so the range is part of the source data the output
    guard compares against.
    """
    lines: list[str] = []
    if customer.industry:
        lines.append(f"Industry: {customer.industry}")
    if customer.industry_tags:
        lines.append(f"Focus areas: {', '.join(customer.industry_tags)}")
    if customer.company_size in COMPANY_SIZES:
        lines.append(f"Company size: {COMPANY_SIZES[customer.company_size]}")
    place = ", ".join(p for p in (customer.hq_city, customer.hq_country) if p)
    if place:
        lines.append(f"Headquarters: {place}")
    if customer.about:
        lines.append(f"About: {customer.about}")
    if customer.contact_name:
        who = customer.contact_name
        if customer.contact_title:
            who += f", {customer.contact_title}"
        lines.append(f"Primary contact: {who}")
    return lines
