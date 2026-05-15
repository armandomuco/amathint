"""Canonical lesson schema normalization and validation primitives."""

from __future__ import annotations

import re
import unicodedata
from copy import deepcopy
from datetime import datetime
from typing import Any


PROMPT_VERSION = "v1"

SUBJECTS: dict[str, dict[str, str]] = {
    "matematike": {
        "subject_full": "Matematikë",
        "fusha": "Matematikë",
        "folder": "Matematike",
        "prefix": "MAT",
    },
}


def strip_accents(value: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFKD", value) if not unicodedata.combining(c)
    )


def slugify(value: str, max_len: int = 60) -> str:
    normalized = strip_accents(value)
    normalized = re.sub(r"[^A-Za-z0-9]+", "_", normalized).strip("_")
    return (normalized[:max_len].strip("_") or "lesson")


def normalize_subject(value: Any, subject_full: Any = None, lesson_id: Any = None) -> str:
    text = strip_accents(str(value or subject_full or "").lower())
    lesson_id_text = str(lesson_id or "").upper()
    if lesson_id_text.startswith("MAT") or "mat" in text:
        return "matematike"
    return "matematike"


def shkalla_for_grade(grade: int) -> str:
    if grade <= 3:
        return "I"
    if grade <= 6:
        return "II"
    return "III"


def lesson_number_from_id(lesson_id: str) -> int | None:
    match = re.search(r"_(\d+)$", lesson_id or "")
    return int(match.group(1)) if match else None


def as_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(v).strip() for v in value if str(v).strip()]
    if isinstance(value, tuple):
        return [str(v).strip() for v in value if str(v).strip()]
    text = str(value).strip()
    if not text:
        return []
    if "\n" in text:
        return [line.strip(" -•\t") for line in text.splitlines() if line.strip(" -•\t")]
    return [text]


def as_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, list):
        return "\n".join(str(v).strip() for v in value if str(v).strip())
    if isinstance(value, dict):
        return "\n".join(
            f"{str(k).replace('_', ' ').title()}: {as_text(v)}"
            for k, v in value.items()
            if as_text(v)
        )
    return str(value).strip()


def keywords_from_topic(topic: str, limit: int = 6) -> list[str]:
    stop = {
        "dhe",
        "me",
        "ne",
        "në",
        "per",
        "për",
        "nga",
        "nje",
        "një",
        "te",
        "të",
        "e",
        "i",
        "a",
    }
    words = []
    for raw in re.split(r"\W+", topic, flags=re.UNICODE):
        word = raw.strip()
        if len(word) > 2 and word.lower() not in stop and word.lower() not in [w.lower() for w in words]:
            words.append(word)
    return words[:limit]


def normalize_methodology(raw: dict[str, Any]) -> dict[str, str]:
    metodologjia = raw.get("metodologjia")
    organizimi = raw.get("organizimi")

    if isinstance(metodologjia, str):
        return {
            "qellimi": "",
            "evokim": "",
            "realizim_kuptimi": metodologjia.strip(),
            "praktike": "",
            "reflektim": "",
            "vleresim": "",
            "nxenes_ak": "",
        }

    result = {
        "qellimi": "",
        "evokim": "",
        "realizim_kuptimi": "",
        "praktike": "",
        "reflektim": "",
        "vleresim": "",
        "nxenes_ak": "",
    }

    if isinstance(metodologjia, dict):
        result["qellimi"] = as_text(metodologjia.get("qellimi"))
        result["evokim"] = as_text(metodologjia.get("evokim"))
        result["realizim_kuptimi"] = as_text(
            metodologjia.get("realizim_kuptimi")
            or metodologjia.get("realizimi")
            or metodologjia.get("aktivitete")
        )
        result["praktike"] = as_text(metodologjia.get("praktike"))
        result["reflektim"] = as_text(
            metodologjia.get("reflektim") or metodologjia.get("mbyllja")
        )
        result["vleresim"] = as_text(metodologjia.get("vleresim"))
        result["nxenes_ak"] = as_text(metodologjia.get("nxenes_ak"))

        situata_realizimi = as_text(metodologjia.get("situata_realizimi"))
        if situata_realizimi and not result["vleresim"]:
            result["vleresim"] = f"Situata quhet e realizuar nëse nxënësi:\n{situata_realizimi}"

    if organizimi and not any(result.values()):
        result["realizim_kuptimi"] = as_text(organizimi)
    elif organizimi and len(as_text(organizimi)) > len(result["realizim_kuptimi"]):
        result["realizim_kuptimi"] = as_text(organizimi)

    return result


def normalize_homework(value: Any) -> dict[str, str]:
    if isinstance(value, dict):
        return {
            "baze": as_text(value.get("baze") or value.get("bazë") or value.get("base")),
            "krijuese": as_text(value.get("krijuese") or value.get("creative")),
            "shtese": as_text(
                value.get("shtese")
                or value.get("shtesë")
                or value.get("advanced")
                or value.get("fakultative")
            ),
        }
    text = as_text(value)
    return {"baze": text, "krijuese": "", "shtese": ""}


def normalize_generation(raw: dict[str, Any], provider: str | None, model: str | None) -> dict[str, str]:
    generation = deepcopy(raw.get("generation") or {})
    generation.setdefault("provider", provider or "unknown")
    generation.setdefault("model", model or "")
    generation.setdefault("prompt_version", PROMPT_VERSION)
    generation.setdefault("generated_at", datetime.now().isoformat(timespec="seconds"))
    return generation


def normalize_lesson(
    raw_lesson: dict[str, Any],
    topic: dict[str, Any] | None = None,
    provider: str | None = None,
    model: str | None = None,
) -> dict[str, Any]:
    """Normalize a raw provider/prototype lesson into the canonical schema."""
    raw = deepcopy(raw_lesson or {})
    topic = deepcopy(topic or {})

    lesson_id = str(raw.get("id") or topic.get("id") or "").strip()
    subject = normalize_subject(
        raw.get("subject") or topic.get("subject"),
        raw.get("subject_full") or raw.get("lenda") or topic.get("subject_full"),
        lesson_id,
    )
    subject_info = SUBJECTS[subject]

    grade = raw.get("grade", raw.get("klasa", topic.get("grade", 7)))
    try:
        grade = int(grade)
    except Exception:
        grade = int(topic.get("grade", 7))

    tema = as_text(raw.get("tema") or raw.get("topic") or topic.get("tema"))
    lesson_number = raw.get("lesson_number") or topic.get("lesson_number") or topic.get("week")
    if not lesson_number and lesson_id:
        lesson_number = lesson_number_from_id(lesson_id)
    try:
        lesson_number = int(lesson_number) if lesson_number is not None else None
    except Exception:
        lesson_number = None

    keywords = (
        as_list(raw.get("fjalet_kyce"))
        or as_list(raw.get("fjalat_kyce"))
        or as_list(raw.get("keywords"))
        or as_list(topic.get("keywords"))
        or keywords_from_topic(tema)
    )

    source_refs = raw.get("source_refs") or topic.get("source_refs") or []
    if not source_refs:
        source_refs = [
            {
                "source_id": str(topic.get("source") or "curriculum_full_catalog"),
                "section": as_text(topic.get("tematika") or raw.get("tematika")),
                "page_or_row": as_text(topic.get("week") or lesson_number or ""),
            }
        ]

    lesson = {
        "id": lesson_id,
        "subject": subject,
        "subject_full": as_text(
            raw.get("subject_full") or raw.get("lenda") or topic.get("subject_full")
        )
        or subject_info["subject_full"],
        "grade": grade,
        "shkalla": as_text(raw.get("shkalla") or topic.get("shkalla")) or shkalla_for_grade(grade),
        "lesson_number": lesson_number,
        "tema": tema,
        "tematika": as_text(raw.get("tematika") or topic.get("tematika")) or "Të përgjithshme",
        "month": as_text(raw.get("month") or raw.get("muaji") or topic.get("month")) or "Shtator",
        "trimester": int(raw.get("trimester") or raw.get("tremujori") or topic.get("trimester") or 1),
        "duration_minutes": int(raw.get("duration_minutes") or raw.get("kohezgjatja") or 45),
        "situata": as_text(raw.get("situata")),
        "rezultatet": as_list(raw.get("rezultatet")),
        "fjalet_kyce": keywords,
        "burimet": as_list(raw.get("burimet")),
        "lidhja": as_text(raw.get("lidhja") or raw.get("lidhja_fushat")),
        "metodologjia": normalize_methodology(raw),
        "detyrat": normalize_homework(raw.get("detyrat")),
        "source_refs": source_refs,
        "generation": normalize_generation(raw, provider, model),
    }

    if not lesson["id"] and subject_info["prefix"] and lesson_number:
        lesson["id"] = f"{subject_info['prefix']}{grade}_{lesson_number:03d}"

    return lesson


def lesson_body_text(lesson: dict[str, Any]) -> str:
    metodologjia = lesson.get("metodologjia") or {}
    return "\n".join(as_text(metodologjia.get(key)) for key in metodologjia)


def homework_text(lesson: dict[str, Any]) -> str:
    return as_text(lesson.get("detyrat"))
