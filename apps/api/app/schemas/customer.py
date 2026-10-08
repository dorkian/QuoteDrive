from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.services.customer_profile import (
    MAX_ABOUT_LENGTH,
    clean_email,
    clean_tags,
    clean_text,
    clean_website,
)

CompanySize = Literal["1-50", "51-200", "201-1000", "1000+"]


class CustomerProfileFields(BaseModel):
    """Optional profile details. Sending null or an empty string clears a field."""

    website: str | None = Field(default=None, max_length=255)
    hq_city: str | None = Field(default=None, max_length=128)
    hq_country: str | None = Field(default=None, max_length=128)
    company_size: CompanySize | None = None
    about: str | None = Field(default=None, max_length=MAX_ABOUT_LENGTH)
    industry_tags: list[str] | None = None
    contact_name: str | None = Field(default=None, max_length=128)
    contact_title: str | None = Field(default=None, max_length=128)
    contact_email: str | None = Field(default=None, max_length=255)

    @field_validator("website")
    @classmethod
    def _website(cls, value: str | None) -> str | None:
        return clean_website(value)

    @field_validator("contact_email")
    @classmethod
    def _email(cls, value: str | None) -> str | None:
        return clean_email(value)

    @field_validator("hq_city", "hq_country", "about", "contact_name", "contact_title")
    @classmethod
    def _text(cls, value: str | None) -> str | None:
        return clean_text(value)

    @field_validator("industry_tags")
    @classmethod
    def _tags(cls, value: list[str] | None) -> list[str] | None:
        return clean_tags(value)


class CustomerCreate(CustomerProfileFields):
    name: str
    industry: str | None = None


class CustomerUpdate(CustomerProfileFields):
    name: str | None = None
    industry: str | None = None
    status: str | None = None


class CustomerOut(BaseModel):
    id: int
    organization_id: int
    name: str
    industry: str | None = None
    status: str
    website: str | None = None
    hq_city: str | None = None
    hq_country: str | None = None
    company_size: str | None = None
    about: str | None = None
    industry_tags: list[str] | None = None
    contact_name: str | None = None
    contact_title: str | None = None
    contact_email: str | None = None
    # Summary fields; see services/summaries.py.
    opportunity_count: int = 0
    open_opportunities: int = 0
    open_pipeline_value: Decimal = Decimal(0)
