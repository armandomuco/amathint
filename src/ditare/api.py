"""Local API service for Amathint."""

from __future__ import annotations

from pathlib import Path
from typing import Literal, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel

from ditare.curriculum.catalog import build_catalog, get_topic, iter_topics, load_catalog
from ditare.generation.generate import generate_from_catalog, load_lesson_json
from ditare.indexing.indexes import build_index, index_status
from ditare.paths import DEFAULT_INDEX_JSON
from ditare.rendering.docx_renderer import DitareDocxRenderer, find_docx
from ditare.settings import MVP_SUBJECT
from ditare.validation.validate_docx import validate_docx
from ditare.validation.validate_lesson import validate_lesson


app = FastAPI(title="Amathint API", version="1.0.0")


class GenerateRequest(BaseModel):
    lesson_id: Optional[str] = None
    subject: Optional[str] = None
    grade: Optional[int] = None
    limit: Optional[int] = None
    provider: str = "fake"
    model: Optional[str] = None
    force: bool = False


class RenderRequest(BaseModel):
    lesson_id: Optional[str] = None
    all: bool = False
    force: bool = False


class ValidationRequest(BaseModel):
    target: Literal["json", "docx", "all"] = "all"
    lesson_id: Optional[str] = None


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "product": "Amathint", "scope": "matematike"}


def _ensure_mvp_subject(subject: Optional[str]) -> str:
    selected = subject or MVP_SUBJECT
    if selected != MVP_SUBJECT:
        raise HTTPException(status_code=400, detail="Amathint MVP supports Mathematics only")
    return selected


def _ensure_math_topic(topic: dict) -> None:
    if topic.get("subject") != MVP_SUBJECT:
        raise HTTPException(status_code=404, detail="Math topic not found")


@app.get("/catalog/topics")
def catalog_topics(
    subject: Optional[str] = None,
    grade: Optional[int] = None,
    limit: Optional[int] = Query(None, ge=1),
):
    subject = _ensure_mvp_subject(subject)
    catalog = load_catalog()
    topics = list(iter_topics(catalog, subject=subject, grade=grade))
    if limit:
        topics = topics[:limit]
    return {"count": len(topics), "topics": topics}


@app.get("/catalog/topics/{lesson_id}")
def catalog_topic(lesson_id: str):
    topic = get_topic(load_catalog(), lesson_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    _ensure_math_topic(topic)
    return topic


@app.post("/lessons/generate")
def lessons_generate(request: GenerateRequest):
    subject = _ensure_mvp_subject(request.subject) if not request.lesson_id else request.subject
    if request.lesson_id:
        topic = get_topic(load_catalog(), request.lesson_id)
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found")
        _ensure_math_topic(topic)
    results = generate_from_catalog(
        subject=subject,
        grade=request.grade,
        lesson_id=request.lesson_id,
        limit=request.limit,
        provider_name=request.provider,
        model=request.model,
        force=request.force,
    )
    return {"count": len(results), "results": [{k: v for k, v in row.items() if k != "lesson"} for row in results]}


@app.post("/lessons/render")
def lessons_render(request: RenderRequest):
    renderer = DitareDocxRenderer()
    rendered = []
    if request.lesson_id:
        lesson = load_lesson_json(request.lesson_id)
        if lesson.get("subject") != MVP_SUBJECT:
            raise HTTPException(status_code=404, detail="Math lesson not found")
        path = renderer.render_lesson_id(request.lesson_id, force=request.force)
        rendered.append(str(path))
    elif request.all:
        catalog = load_catalog()
        for topic in catalog.get("topics", []):
            if topic.get("subject") != MVP_SUBJECT:
                continue
            try:
                lesson = load_lesson_json(topic["id"])
            except FileNotFoundError:
                continue
            rendered.append(str(renderer.render_to_path(lesson, force=request.force)))
    else:
        raise HTTPException(status_code=400, detail="Provide lesson_id or all=true")
    return {"count": len(rendered), "paths": rendered}


@app.post("/validation/run")
def validation_run(request: ValidationRequest):
    if request.lesson_id:
        lesson = load_lesson_json(request.lesson_id)
        if lesson.get("subject") != MVP_SUBJECT:
            raise HTTPException(status_code=404, detail="Math lesson not found")
        result = {"lesson_id": request.lesson_id}
        if request.target in {"json", "all"}:
            result["json_errors"] = validate_lesson(lesson)
        if request.target in {"docx", "all"}:
            path = find_docx(request.lesson_id)
            result["docx_errors"] = validate_docx(path) if path else ["DOCX missing"]
        return result
    index = build_index(subject=MVP_SUBJECT)
    return {
        "total_topics": index["total_topics"],
        "valid_json": index["valid_json"],
        "valid_docx": index["valid_docx"],
    }


@app.get("/indexes")
def indexes():
    status = index_status()
    if DEFAULT_INDEX_JSON.exists():
        status["summary"] = build_index(subject=MVP_SUBJECT)
    return status


@app.get("/artifacts/{lesson_id}")
def artifact(lesson_id: str, artifact_type: Literal["docx", "json"] = "docx"):
    lesson = load_lesson_json(lesson_id)
    if lesson.get("subject") != MVP_SUBJECT:
        raise HTTPException(status_code=404, detail="Math lesson not found")
    if artifact_type == "json":
        # Return canonical JSON directly for API clients.
        return lesson
    path = find_docx(lesson_id)
    if not path:
        raise HTTPException(status_code=404, detail="DOCX artifact not found")
    return FileResponse(
        path=Path(path),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=Path(path).name,
    )


@app.post("/catalog/build")
def catalog_build():
    catalog = build_catalog()
    return catalog["metadata"]
