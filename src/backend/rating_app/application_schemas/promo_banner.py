import uuid
from dataclasses import dataclass


@dataclass(frozen=True)
class PromoBanner:
    id: uuid.UUID
    title: str
    href: str
    cta_label: str
    description: str = ""
    logo_url: str | None = None
    logo_alt: str = ""
