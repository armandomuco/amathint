from __future__ import annotations

import json

from fastapi.testclient import TestClient
from docx import Document

from ditare.api import app
from ditare.curriculum.catalog import normalize_topic
from ditare.generation.providers import FakeProvider
from ditare.generation.schema import normalize_lesson
from ditare.rendering.docx_renderer import DitareDocxRenderer
from ditare.validation.validate_docx import validate_docx
from ditare.validation.validate_lesson import validate_lesson


def test_fake_provider_renderer_acceptance(tmp_path):
    topic = normalize_topic(
        {
            "id": "MAT7_001",
            "subject": "matematike",
            "subject_full": "Matematikë",
            "grade": 7,
            "tema": "Lojë me numrat",
            "tematika": "Numrat",
            "month": "Shtator",
            "week": 1,
        }
    )
    provider = FakeProvider()
    lesson = normalize_lesson(provider.generate(topic), topic=topic, provider=provider.name, model=provider.model)
    assert validate_lesson(lesson) == []

    out = tmp_path / "ditare.docx"
    path = DitareDocxRenderer().render_to_path(lesson, out)
    assert path.exists()
    assert validate_docx(path) == []

    table = Document(path).tables[0]
    assert "Lënda Matematikë" in table.rows[0].cells[1].text
    assert "Klasa VII" in table.rows[0].cells[3].text
    assert "Fjalët kyçe" in table.rows[2].cells[2].text


def test_api_health_and_topics():
    client = TestClient(app)
    assert client.get("/health").json() == {"status": "ok", "product": "Amathint", "scope": "matematike"}
    response = client.get("/catalog/topics?limit=1")
    assert response.status_code == 200
    assert "topics" in response.json()
    assert response.json()["topics"][0]["subject"] == "matematike"


def test_api_generate_render_validate_cycle():
    client = TestClient(app)
    generate = client.post(
        "/lessons/generate",
        json={"lesson_id": "MAT7_001", "provider": "fake", "force": True},
    )
    assert generate.status_code == 200
    assert generate.json()["count"] == 1

    render = client.post("/lessons/render", json={"lesson_id": "MAT7_001", "force": True})
    assert render.status_code == 200
    assert render.json()["count"] == 1

    validation = client.post("/validation/run", json={"lesson_id": "MAT7_001", "target": "all"})
    assert validation.status_code == 200
    body = validation.json()
    assert body["json_errors"] == []
    assert body["docx_errors"] == []
