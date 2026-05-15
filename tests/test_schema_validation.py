from __future__ import annotations

import pytest

from ditare.generation.schema import normalize_lesson
from ditare.validation.validate_lesson import validate_lesson


def topic():
    return {
        "id": "MAT7_021",
        "subject": "matematike",
        "subject_full": "Matematikë",
        "grade": 7,
        "shkalla": "III",
        "lesson_number": 21,
        "tema": "Këndet në drejtëza paralele",
        "tematika": "Gjeometria",
        "month": "Tetor",
        "trimester": 1,
        "keywords": ["kënde", "drejtëza", "paralele"],
    }


def test_normalizer_maps_legacy_fields():
    raw = {
        "klasa": 7,
        "lenda": "Matematikë",
        "fjalat_kyce": ["kënd", "paralele"],
        "lidhja_fushat": "Lidhje me fizikën dhe artin.",
        "organizimi": "QËLLIMI: " + ("tekst i gjatë. " * 80),
        "detyrat": "Zgjidhni ushtrimet 1-5.",
        "situata": "Situatë konkrete.",
        "rezultatet": ["A", "B", "C"],
        "burimet": ["Libri", "Fletë pune"],
    }
    lesson = normalize_lesson(raw, topic=topic(), provider="fake", model="fake-v1")
    assert lesson["grade"] == 7
    assert lesson["fjalet_kyce"] == ["kënd", "paralele"]
    assert lesson["lidhja"] == "Lidhje me fizikën dhe artin."
    assert "tekst i gjatë" in lesson["metodologjia"]["realizim_kuptimi"]
    assert lesson["subject"] == "matematike"


def test_validator_rejects_blank_required_content():
    bad = normalize_lesson({}, topic=topic())
    bad["tema"] = ""
    bad["fjalet_kyce"] = []
    bad["metodologjia"]["realizim_kuptimi"] = "too short"
    errors = validate_lesson(bad)
    assert "tema is required" in errors
    assert "fjalet_kyce must not be blank" in errors
    assert any("metodologjia body" in error for error in errors)
