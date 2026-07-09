"""Shared pagination helpers for list endpoints."""
from typing import Any, TypeVar
from sqlalchemy.orm import Query

T = TypeVar("T")


def paginate(q: Query, page: int = 1, page_size: int = 25, max_page_size: int = 200) -> tuple[list[Any], int]:
    page = max(1, page)
    page_size = min(max(1, page_size), max_page_size)
    total = q.count()
    items = q.offset((page - 1) * page_size).limit(page_size).all()
    return items, total


def page_response(items: list, total: int, page: int, page_size: int, extra: dict | None = None) -> dict:
    out = {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, (total + page_size - 1) // page_size) if page_size else 1,
    }
    if extra:
        out.update(extra)
    return out
