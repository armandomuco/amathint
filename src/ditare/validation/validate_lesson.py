"""Validation for canonical lesson JSON."""

from __future__ import annotations

from ditare.generation.schema import as_text, homework_text, lesson_body_text


def validate_lesson(lesson: dict, min_body_chars: int = 500) -> list[str]:
    """Return validation errors for a canonical lesson."""
    errors: list[str] = []

    required_text = {
        "id": lesson.get("id"),
        "subject": lesson.get("subject"),
        "subject_full": lesson.get("subject_full"),
        "shkalla": lesson.get("shkalla"),
        "tema": lesson.get("tema"),
        "tematika": lesson.get("tematika"),
        "month": lesson.get("month"),
        "situata": lesson.get("situata"),
        "lidhja": lesson.get("lidhja"),
    }
    for key, value in required_text.items():
        if not as_text(value):
            errors.append(f"{key} is required")

    if not isinstance(lesson.get("grade"), int) or not 1 <= lesson["grade"] <= 9:
        errors.append("grade must be an integer from 1 to 9")

    if not lesson.get("lesson_number"):
        errors.append("lesson_number is required")

    if len(lesson.get("rezultatet") or []) < 3:
        errors.append("at least 3 learning outcomes are required")

    if not lesson.get("fjalet_kyce"):
        errors.append("fjalet_kyce must not be blank")

    if not lesson.get("burimet"):
        errors.append("burimet must not be blank")

    body = lesson_body_text(lesson)
    if len(body) < min_body_chars:
        errors.append(f"metodologjia body must be at least {min_body_chars} characters")

    if not homework_text(lesson):
        errors.append("detyrat must not be blank")

    return errors


def assert_valid_lesson(lesson: dict, min_body_chars: int = 500) -> None:
    errors = validate_lesson(lesson, min_body_chars=min_body_chars)
    if errors:
        raise ValueError("; ".join(errors))
