from __future__ import annotations

from django import template

register = template.Library()


@register.filter(name="length_is")
def length_is(value: object, expected_length: str | int) -> bool:
    """Mimic the deprecated ``length_is`` filter used by Jazzmin templates."""
    try:
        expected = int(expected_length)
    except (TypeError, ValueError):
        return False

    try:
        actual_length = len(value)  # type: ignore[arg-type]
    except TypeError:
        return False

    return actual_length == expected
