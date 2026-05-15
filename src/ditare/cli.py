"""Command line interface for Amathint."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from ditare.curriculum.catalog import build_catalog, load_catalog
from ditare.generation.generate import generate_from_catalog, load_lesson_json, sample_gate_topics
from ditare.generation.providers import get_provider
from ditare.generation.schema import normalize_lesson
from ditare.paths import DEFAULT_CATALOG_PATH, DITARE_DOCX_DIR, LESSONS_JSON_DIR, ensure_runtime_dirs
from ditare.settings import MVP_SUBJECT
from ditare.validation.validate_lesson import validate_lesson


def cmd_catalog_build(args) -> int:
    catalog = build_catalog(input_path=args.input, output_path=args.output)
    print(json.dumps(catalog["metadata"], ensure_ascii=False, indent=2))
    return 0


def cmd_generate(args) -> int:
    subject = args.subject or MVP_SUBJECT
    results = generate_from_catalog(
        subject=subject,
        grade=args.grade,
        lesson_id=args.lesson_id,
        limit=args.limit,
        provider_name=args.provider,
        model=args.model,
        force=args.force,
    )
    for result in results:
        print(f"{result['status']}: {result['id']} -> {result['json_path']}")
    print(f"Total: {len(results)}")
    return 0


def cmd_render(args) -> int:
    from ditare.rendering.docx_renderer import DitareDocxRenderer

    renderer = DitareDocxRenderer()
    paths = []
    if args.lesson_id:
        paths.append(renderer.render_lesson_id(args.lesson_id, force=args.force))
    elif args.all:
        for json_path in sorted(LESSONS_JSON_DIR.rglob("*.json")):
            with open(json_path, "r", encoding="utf-8") as f:
                lesson = json.load(f)
            if lesson.get("subject") != MVP_SUBJECT:
                continue
            paths.append(renderer.render_to_path(lesson, force=args.force))
    else:
        raise SystemExit("Use --lesson-id or --all")
    for path in paths:
        print(path)
    print(f"Rendered: {len(paths)}")
    return 0


def _validate_json_files(lesson_id: str | None = None) -> list[tuple[str, list[str]]]:
    rows = []
    if lesson_id:
        lesson = load_lesson_json(lesson_id)
        rows.append((lesson_id, validate_lesson(lesson)))
        return rows
    for path in sorted(LESSONS_JSON_DIR.rglob("*.json")):
        with open(path, "r", encoding="utf-8") as f:
            lesson = json.load(f)
        if lesson.get("subject") != MVP_SUBJECT:
            continue
        rows.append((str(path), validate_lesson(lesson)))
    return rows


def _validate_docx_files(lesson_id: str | None = None) -> list[tuple[str, list[str]]]:
    from ditare.rendering.docx_renderer import find_docx
    from ditare.validation.validate_docx import validate_docx

    rows = []
    if lesson_id:
        path = find_docx(lesson_id)
        rows.append((lesson_id, validate_docx(path) if path else ["DOCX missing"]))
        return rows
    for path in sorted((DITARE_DOCX_DIR / "Matematike").rglob("*.docx")):
        rows.append((str(path), validate_docx(path)))
    return rows


def cmd_validate(args) -> int:
    rows = []
    if args.target in {"json", "all"}:
        rows.extend(("json", key, errors) for key, errors in _validate_json_files(args.lesson_id))
    if args.target in {"docx", "all"}:
        rows.extend(("docx", key, errors) for key, errors in _validate_docx_files(args.lesson_id))

    failed = 0
    for kind, key, errors in rows:
        if errors:
            failed += 1
            print(f"FAIL {kind} {key}: {'; '.join(errors)}")
        else:
            print(f"OK   {kind} {key}")
    print(f"Checked: {len(rows)} | Failed: {failed}")
    return 1 if failed else 0


def cmd_index_build(args) -> int:
    from ditare.indexing.indexes import build_index

    index = build_index(subject=MVP_SUBJECT)
    print(json.dumps({k: v for k, v in index.items() if k != "lessons"}, ensure_ascii=False, indent=2))
    return 0


def cmd_run_sample_gate(args) -> int:
    from ditare.indexing.indexes import build_index
    from ditare.rendering.docx_renderer import DitareDocxRenderer
    from ditare.validation.validate_docx import validate_docx

    ensure_runtime_dirs()
    catalog = load_catalog()
    provider = get_provider(args.provider, model=args.model)
    topics = sample_gate_topics(catalog)
    renderer = DitareDocxRenderer()
    results = []
    for topic in topics:
        raw = provider.generate(topic)
        lesson = normalize_lesson(raw, topic=topic, provider=provider.name, model=provider.model)
        json_errors = validate_lesson(lesson)
        if json_errors:
            results.append({"id": topic["id"], "json_errors": json_errors, "docx_errors": ["not rendered"]})
            continue
        from ditare.generation.generate import save_lesson_json

        save_lesson_json(lesson, force=args.force)
        docx_path = renderer.render_to_path(lesson, force=args.force)
        results.append({"id": topic["id"], "json_errors": [], "docx_path": str(docx_path), "docx_errors": validate_docx(docx_path)})
    build_index()
    print(json.dumps(results, ensure_ascii=False, indent=2))
    return 1 if any(row["json_errors"] or row["docx_errors"] for row in results) else 0


def cmd_api_serve(args) -> int:
    import uvicorn
    from ditare.api import app

    uvicorn.run(app, host=args.host, port=args.port)
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="amathint",
        description="Amathint - Albanian Mathematics Ditare lesson report pipeline",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    catalog = sub.add_parser("catalog")
    catalog_sub = catalog.add_subparsers(dest="catalog_command", required=True)
    catalog_build = catalog_sub.add_parser("build")
    catalog_build.add_argument("--input")
    catalog_build.add_argument("--output", default=str(DEFAULT_CATALOG_PATH))
    catalog_build.set_defaults(func=cmd_catalog_build)

    generate = sub.add_parser("generate")
    generate.add_argument("--subject", default=MVP_SUBJECT, choices=[MVP_SUBJECT])
    generate.add_argument("--grade", type=int)
    generate.add_argument("--lesson-id")
    generate.add_argument("--limit", type=int)
    generate.add_argument("--provider", default="fake", choices=["fake", "anthropic"])
    generate.add_argument("--model")
    generate.add_argument("--force", action="store_true")
    generate.set_defaults(func=cmd_generate)

    render = sub.add_parser("render")
    render.add_argument("--lesson-id")
    render.add_argument("--all", action="store_true")
    render.add_argument("--force", action="store_true")
    render.set_defaults(func=cmd_render)

    validate = sub.add_parser("validate")
    validate.add_argument("target", choices=["json", "docx", "all"])
    validate.add_argument("--lesson-id")
    validate.set_defaults(func=cmd_validate)

    index = sub.add_parser("index")
    index_sub = index.add_subparsers(dest="index_command", required=True)
    index_build = index_sub.add_parser("build")
    index_build.set_defaults(func=cmd_index_build)

    sample = sub.add_parser("run-sample-gate")
    sample.add_argument("--provider", default="fake", choices=["fake", "anthropic"])
    sample.add_argument("--model")
    sample.add_argument("--force", action="store_true")
    sample.set_defaults(func=cmd_run_sample_gate)

    api = sub.add_parser("api")
    api_sub = api.add_subparsers(dest="api_command", required=True)
    serve = api_sub.add_parser("serve")
    serve.add_argument("--host", default="127.0.0.1")
    serve.add_argument("--port", default=8000, type=int)
    serve.set_defaults(func=cmd_api_serve)
    return parser


def main(argv: list[str] | None = None) -> int:
    ensure_runtime_dirs()
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
