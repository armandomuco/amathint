# Amathint Generator and AI Handoff Plan

## Purpose

Amathint is the cleaned V1 implementation of the daily Albanian lesson-report generator.

The product name is Amathint. The Albanian report format it renders is still a `Ditare`.

The project now has two clear responsibilities:

- Amathint generates canonical lesson JSON, validates it, renders teacher-facing DOCX reports, and builds searchable indexes.
- The future thesis AI should consume Amathint's clean catalog, canonical JSON, indexes, and source documents instead of depending on legacy scripts or rendered Word files.

## Current Snapshot

The repository has been reorganized into a clean pipeline:

```text
src/ditare/                       Pipeline implementation
data/sources/                     Source and reference material
data/catalog/curriculum_catalog.json
data/generated/lessons_json/      Canonical lesson JSON
outputs/amathint_docx/           Rendered Word reports
outputs/indexes/                  Searchable JSON/XLSX indexes
docs/AMATHINT_GUIDE.md           Operating guide
```

## Source Of Truth

Use this priority order:

1. Ministry/curriculum source documents under `data/sources/`
2. Cleaned catalog at `data/catalog/curriculum_catalog.json`
3. Validated canonical lesson JSON under `data/generated/lessons_json/`
4. Search/index artifacts under `outputs/indexes/`

Rendered DOCX files under `outputs/amathint_docx/` are teacher-facing artifacts, not the knowledge base.

## Implemented Pipeline

```text
curriculum topic
  -> provider adapter
  -> raw JSON
  -> normalize
  -> validate JSON
  -> save canonical JSON
  -> render DOCX
  -> validate DOCX
  -> index
```

The pipeline supports deterministic fake generation for development and real Anthropic generation behind a provider adapter. Other providers can be added later without changing the renderer or API contract.

## Canonical Contract

Every lesson is saved with stable keys:

```text
id
subject
subject_full
grade
shkalla
lesson_number
tema
tematika
month
trimester
duration_minutes
situata
rezultatet
fjalet_kyce
burimet
lidhja
metodologjia
detyrat
source_refs
generation
```

The normalizer accepts older field variants, including:

```text
klasa -> grade
fjalat_kyce -> fjalet_kyce
lidhja_fushat -> lidhja
organizimi -> metodologjia
lenda -> subject_full
```

After normalization, downstream code should only read canonical keys.

## CLI Surface

The main command is:

```bash
./amathint
```

Important commands:

```bash
./amathint catalog build
./amathint run-sample-gate --force
./amathint generate --subject matematike --grade 7 --limit 5 --provider fake
./amathint generate --lesson-id MAT7_001 --provider anthropic./amathint render --lesson-id MAT7_001 --force
./amathint render --all
./amathint validate all
./amathint index build
./amathint api serve --host 127.0.0.1 --port 8000
```

The old `./ditare` command remains as a compatibility alias.

## API Surface

The API is intentionally a local integration layer, not a polished teacher portal.

```text
GET  /health
GET  /catalog/topics
GET  /catalog/topics/{lesson_id}
POST /lessons/generate
POST /lessons/render
POST /validation/run
GET  /indexes
GET  /artifacts/{lesson_id}
GET  /artifacts/{lesson_id}?artifact_type=json
```

This is enough for a future UI or the thesis AI to trigger generation, inspect topics, validate artifacts, and fetch JSON/DOCX outputs.

## Quality Gate

Before a full generation run:

```bash
./amathint run-sample-gate --force
./amathint validate all
./amathint index build
```

The gate should include one Mathematics sample lesson only. The renderer and validator make sure visible report cells are not blank.

For real batches, prefer small resumable runs:

```bash
export ANTHROPIC_API_KEY="..."
./amathint generate --subject matematike --grade 7 --limit 10 --provider anthropic
./amathint render --all
./amathint validate all
./amathint index build
```

Do not use `--force` during large real runs unless you intentionally want to overwrite valid existing JSON.

## Thesis AI Boundary

The thesis AI should be a separate layer. It can use Amathint outputs, but should not be tangled with the generator internals.

Recommended AI modules:

```text
ai_thesis/
  ingestion/      Load source docs, catalog, canonical lesson JSON
  retrieval/      Chunking, embeddings, search, citations
  api_or_app/     Teacher/student Q&A surface
  evaluation/     Answer quality tests and citation checks
```

Recommended behavior:

- Teacher asks for tomorrow's lesson: AI can retrieve curriculum context and optionally call Amathint generation/render endpoints.
- Student asks for help: AI should answer from curriculum/source context and explain in student-friendly Albanian.
- AI should cite the curriculum/source refs it used.
- AI should not present generated lesson text as ministry truth unless it is tied back to source material.

## What To Avoid

- Do not build new features on ``.
- Do not scrape generated DOCX files back into the AI as the main knowledge base.
- Do not commit API keys.
- Do not mix temporary experiments into `data/generated/lessons_json/`.
- Do not overwrite validated JSON during large runs without an explicit reason.

## Next Good Improvements

1. Add source-document chunking under a separate `ai_thesis/` area.
2. Enrich `source_refs` with stronger page/section identifiers from ministry files.
3. Add reviewer notes or a quality CSV for teacher feedback.
4. Add more provider adapters if OpenAI/local models are needed.
5. Add a small web UI only after the CLI/API workflow stays stable.
