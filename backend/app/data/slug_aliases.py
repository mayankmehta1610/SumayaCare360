"""API backlog slug aliases from Excel workbook (comma variants)."""

SLUG_ALIASES: dict[str, str] = {
    "billing,-tariff-and-payments": "billing-tariff-and-payments",
    "identity,-rbac-and-security": "identity-rbac-and-security",
    "diet,-catering-and-housekeeping": "diet-catering-and-housekeeping",
    "document,-forms-and-templates": "document-forms-and-templates",
    "inventory,-procurement-and-stores": "inventory-procurement-and-stores",
    "reports,-bi-and-analytics": "reports-bi-and-analytics",
    "women,-child-and-specialty-care": "women-child-and-specialty-care",
}


def normalize_slug(slug: str) -> str:
    return SLUG_ALIASES.get(slug, slug)
