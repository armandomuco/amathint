"""Catalog building and lookup."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Iterable

from ditare.generation.schema import SUBJECTS, keywords_from_topic, normalize_subject, shkalla_for_grade
from ditare.paths import DEFAULT_CATALOG_PATH, ensure_runtime_dirs, find_catalog_input
from ditare.settings import MVP_SUBJECT


def is_math_topic(raw_topic: dict) -> bool:
    lesson_id = str(raw_topic.get("id") or "").upper()
    subject = str(raw_topic.get("subject") or "").lower()
    subject_full = str(raw_topic.get("subject_full") or "").lower()
    return lesson_id.startswith("MAT") or "mat" in subject or "mat" in subject_full


def normalize_topic(raw_topic: dict) -> dict:
    lesson_id = str(raw_topic.get("id") or "").strip()
    subject = normalize_subject(raw_topic.get("subject"), raw_topic.get("subject_full"), lesson_id)
    grade = int(raw_topic.get("grade") or 7)
    lesson_number = raw_topic.get("lesson_number") or raw_topic.get("week")
    if lesson_number is None and "_" in lesson_id:
        try:
            lesson_number = int(lesson_id.split("_")[-1])
        except Exception:
            lesson_number = None
    lesson_number = int(lesson_number or 1)
    subject_info = SUBJECTS[subject]

    return {
        "id": lesson_id or f"{subject_info['prefix']}{grade}_{lesson_number:03d}",
        "subject": subject,
        "subject_full": raw_topic.get("subject_full") or subject_info["subject_full"],
        "grade": grade,
        "shkalla": raw_topic.get("shkalla") or shkalla_for_grade(grade),
        "lesson_number": lesson_number,
        "tema": str(raw_topic.get("tema") or raw_topic.get("topic") or "").strip(),
        "tematika": str(raw_topic.get("tematika") or raw_topic.get("section") or "Të përgjithshme").strip(),
        "hours": int(raw_topic.get("hours") or 1),
        "trimester": int(raw_topic.get("trimester") or 1),
        "month": str(raw_topic.get("month") or raw_topic.get("month_suggested") or "Shtator").strip(),
        "keywords": raw_topic.get("keywords") or keywords_from_topic(str(raw_topic.get("tema") or "")),
        "source_refs": raw_topic.get("source_refs")
        or [
            {
                "source_id": str(raw_topic.get("source") or "curriculum_full_catalog"),
                "section": str(raw_topic.get("tematika") or raw_topic.get("section") or ""),
                "page_or_row": str(raw_topic.get("week") or lesson_number),
            }
        ],
    }


def build_catalog(
    input_path: str | Path | None = None,
    output_path: str | Path = DEFAULT_CATALOG_PATH,
) -> dict:
    ensure_runtime_dirs()
    source = find_catalog_input(input_path)
    with open(source, "r", encoding="utf-8") as f:
        payload = json.load(f)

    raw_topics = payload.get("topics", payload if isinstance(payload, list) else [])
    topics = [
        normalize_topic(t)
        for t in raw_topics
        if (t.get("tema") or t.get("topic")) and is_math_topic(t)
    ]
    topics.sort(key=lambda t: (t["subject"], t["grade"], t["lesson_number"], t["id"]))

    catalog = {
        "metadata": {
            "generated_at": datetime.now().isoformat(timespec="seconds"),
            "source_path": str(source),
            "total_topics": len(topics),
            "scope": MVP_SUBJECT,
            "version": "1.0",
        },
        "topics": topics,
    }

    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    with open(output, "w", encoding="utf-8") as f:
        json.dump(catalog, f, ensure_ascii=False, indent=2)
    return catalog


def load_catalog(path: str | Path = DEFAULT_CATALOG_PATH) -> dict:
    catalog_path = Path(path)
    if not catalog_path.exists():
        return build_catalog(output_path=catalog_path)
    with open(catalog_path, "r", encoding="utf-8") as f:
        return json.load(f)


def iter_topics(
    catalog: dict,
    subject: str | None = None,
    grade: int | None = None,
    lesson_id: str | None = None,
) -> Iterable[dict]:
    for topic in catalog.get("topics", []):
        if subject and topic.get("subject") != subject:
            continue
        if grade and int(topic.get("grade")) != int(grade):
            continue
        if lesson_id and topic.get("id") != lesson_id:
            continue
        yield topic


def get_topic(catalog: dict, lesson_id: str) -> dict | None:
    return next(iter_topics(catalog, lesson_id=lesson_id), None)
