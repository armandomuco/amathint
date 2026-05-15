"""Generation orchestration for canonical lessons."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable

from ditare.curriculum.catalog import get_topic, iter_topics, load_catalog
from ditare.generation.providers import get_provider
from ditare.generation.schema import normalize_lesson, slugify
from ditare.paths import DEFAULT_CATALOG_PATH, LESSONS_JSON_DIR, ensure_runtime_dirs
from ditare.validation.validate_lesson import assert_valid_lesson


def lesson_json_path(lesson: dict, base_dir: Path = LESSONS_JSON_DIR) -> Path:
    subject = lesson["subject"]
    grade = lesson["grade"]
    filename = f"{lesson['id']}_{slugify(lesson['tema'], 50)}.json"
    return base_dir / subject / f"Klasa_{grade}" / filename


def find_lesson_json(lesson_id: str, base_dir: Path = LESSONS_JSON_DIR) -> Path | None:
    matches = sorted(base_dir.rglob(f"{lesson_id}_*.json"))
    if matches:
        return matches[0]
    direct = sorted(base_dir.rglob(f"{lesson_id}.json"))
    return direct[0] if direct else None


def load_lesson_json(lesson_id: str, base_dir: Path = LESSONS_JSON_DIR) -> dict:
    path = find_lesson_json(lesson_id, base_dir)
    if not path:
        raise FileNotFoundError(f"No canonical JSON found for {lesson_id}")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_lesson_json(lesson: dict, force: bool = False, base_dir: Path = LESSONS_JSON_DIR) -> Path:
    path = lesson_json_path(lesson, base_dir=base_dir)
    if path.exists() and not force:
        return path
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(lesson, f, ensure_ascii=False, indent=2)
    return path


def generate_for_topics(
    topics: Iterable[dict],
    provider_name: str = "fake",
    model: str | None = None,
    force: bool = False,
    min_body_chars: int = 500,
) -> list[dict]:
    ensure_runtime_dirs()
    provider = get_provider(provider_name, model=model)
    results = []
    for topic in topics:
        existing = find_lesson_json(topic["id"])
        if existing and not force:
            with open(existing, "r", encoding="utf-8") as f:
                lesson = json.load(f)
            results.append({"id": topic["id"], "status": "skipped", "json_path": str(existing), "lesson": lesson})
            continue

        raw = provider.generate(topic)
        lesson = normalize_lesson(raw, topic=topic, provider=provider.name, model=provider.model)
        assert_valid_lesson(lesson, min_body_chars=min_body_chars)
        path = save_lesson_json(lesson, force=True)
        results.append({"id": lesson["id"], "status": "generated", "json_path": str(path), "lesson": lesson})
    return results


def generate_from_catalog(
    catalog_path: str | Path = DEFAULT_CATALOG_PATH,
    subject: str | None = None,
    grade: int | None = None,
    lesson_id: str | None = None,
    limit: int | None = None,
    provider_name: str = "fake",
    model: str | None = None,
    force: bool = False,
) -> list[dict]:
    catalog = load_catalog(catalog_path)
    if lesson_id:
        topic = get_topic(catalog, lesson_id)
        if not topic:
            raise KeyError(f"Topic not found: {lesson_id}")
        topics = [topic]
    else:
        topics = list(iter_topics(catalog, subject=subject, grade=grade))
    if limit:
        topics = topics[:limit]
    return generate_for_topics(topics, provider_name=provider_name, model=model, force=force)


def sample_gate_topics(catalog: dict) -> list[dict]:
    wanted = [("matematike", 7)]
    topics = []
    for subject, grade in wanted:
        topic = next(iter_topics(catalog, subject=subject, grade=grade), None)
        if topic:
            topics.append(topic)
    return topics

