# Amathint

Amathint is a local pipeline for generating consistent Albanian school daily lesson reports in the traditional `Ditare` format.

The document format is still Ditare. The product tooling for the MSc project is Amathint.

## What It Does

Amathint turns curriculum topics into three clean artifacts:

- Canonical lesson JSON in `data/generated/lessons_json/`
- Rendered Word reports in `outputs/amathint_docx/`
- Searchable indexes in `outputs/indexes/index.json` and `outputs/indexes/index.xlsx`

The canonical JSON is the source of truth. DOCX files are output artifacts and can always be regenerated.

## Quick Start

```bash
./amathint catalog build
./amathint run-sample-gate --force
./amathint validate all
./amathint index build
```

The sample gate generates one Mathematics lesson with the offline fake provider, renders its DOCX file, validates it, and rebuilds the math-only indexes.

The old `./ditare` command still works as a compatibility alias for the report format, but new docs use `./amathint`.

## How The Pipeline Works

```text
curriculum catalog topic
  -> provider adapter
  -> raw lesson JSON
  -> canonical normalizer
  -> JSON validation
  -> saved canonical JSON
  -> DOCX renderer
  -> DOCX validation
  -> JSON/XLSX indexes
```

The important design decision is that AI generation, DOCX rendering, validation, and indexing are separate steps. That makes the system resumable and easier for the thesis AI layer to consume later.

## Repository Layout

```text
src/ditare/
  curriculum/                 Catalog building and topic loading
  generation/                 Schema, normalizer, providers, generation flow
  rendering/                  DOCX renderer for the Ditare table
  validation/                 JSON and DOCX quality checks
  indexing/                   JSON/XLSX index builder
  api.py                      Local FastAPI service
  cli.py                      Amathint command line interface

data/
  sources/                    Ministry/source material and teacher samples
  catalog/
    curriculum_catalog.json   Cleaned catalog used by the pipeline
  generated/
    lessons_json/             Canonical lesson JSON source of truth
    validation_reports/       Reserved for future reports

outputs/
  amathint_docx/             Rendered Word daily reports
  indexes/
    index.json                Machine-friendly searchable index
    index.xlsx                Human-friendly spreadsheet index

docs/
  AMATHINT_GUIDE.md          Detailed operating guide
```

`src/ditare` is intentionally still named after the report format. The CLI/product name is Amathint.

## Canonical Lesson JSON

Every generated lesson is normalized to one schema before saving or rendering:

```json
{
  "id": "MAT7_001",
  "subject": "matematike",
  "subject_full": "Matematike",
  "grade": 7,
  "shkalla": "III",
  "lesson_number": 1,
  "tema": "Tema e mesimit",
  "tematika": "Tematika",
  "month": "Shtator",
  "trimester": 1,
  "duration_minutes": 45,
  "situata": "...",
  "rezultatet": ["..."],
  "fjalet_kyce": ["..."],
  "burimet": ["..."],
  "lidhja": "...",
  "metodologjia": {
    "qellimi": "...",
    "evokim": "...",
    "realizim_kuptimi": "...",
    "praktike": "...",
    "reflektim": "...",
    "vleresim": "...",
    "nxenes_ak": "..."
  },
  "detyrat": {
    "baze": "...",
    "krijuese": "...",
    "shtese": "..."
  },
  "source_refs": [],
  "generation": {
    "provider": "fake",
    "model": "fake-v1",
    "prompt_version": "v1",
    "generated_at": "2026-05-01T12:00:00"
  }
}
```

The normalizer accepts older variants such as `klasa`, `fjalat_kyce`, `lidhja_fushat`, and `organizimi`, then writes canonical keys only.

## CLI Reference

Build or refresh the clean catalog:

```bash
./amathint catalog build
```

Generate deterministic sample lessons without an API key:

```bash
./amathint generate --subject matematike --grade 7 --limit 5 --provider fake
```

Generate one lesson by lesson id:

```bash
./amathint generate --lesson-id MAT7_001 --provider fake --force
```

Generate through Anthropic:

```bash
export ANTHROPIC_API_KEY="..."
./amathint generate --lesson-id MAT7_001 --provider anthropic
```

Import old LLM JSON backups into the canonical format:

```bash```

Render one lesson or all existing canonical JSON files:

```bash
./amathint render --lesson-id MAT7_001 --force
./amathint render --all
```

Validate JSON, DOCX, or both:

```bash
./amathint validate json
./amathint validate docx
./amathint validate all
```

Build searchable indexes:

```bash
./amathint index build
```

Run the full small safety gate:

```bash
./amathint run-sample-gate --force
```

Start the local API:

```bash
./amathint api serve --host 127.0.0.1 --port 8000
```

## Phase 2 Backend API

The new backend-only application lives in `apps/api`. It is a NestJS API with Prisma and a local PostgreSQL database for the MSc prototype.

Run it locally:

```bash
cd apps/api
npm install
npm run prisma:push
npm run dev
```

Local database connection:

```bash
DATABASE_URL="postgresql://simplitime:simplitime@localhost:5432/amathint_dev?schema=public"
```

For the real student chatbot, configure these values in `apps/api/.env`:

```bash
STUDENT_CHAT_PROVIDER="anthropic"
STUDENT_CHAT_MODEL="claude-sonnet-4-20250514"
ANTHROPIC_API_KEY="your-anthropic-key"
```

Current backend endpoints:

```text
GET  /health        Backend health check
POST /auth/signup   Create teacher or student accounts
POST /auth/login    Login and receive a bearer session token
GET  /auth/me       Read the current user from Authorization: Bearer <token>
POST /auth/logout   Delete the current session
```

This phase is backend-only. Dashboard, signup/login screens, teacher UI, student UI, and chat UI are intentionally postponed until the backend structure is stable.

## Phase 3 Student Math Q/A Chatbot

The student chatbot is intentionally simple and lives in one small NestJS module: `apps/api/src/student-chat`. It is for Mathematics Q/A only. It explains concepts and methods, but it does not solve full exercises for the student.

Student chatbot endpoints:

```text
POST /chatbot/student/messages           Ask a Mathematics question
GET  /chatbot/student/conversations       List the student's conversations
GET  /chatbot/student/conversations/:id   Read one conversation with messages
```

The older `/student-chat/...` endpoints are still available as a backend alias.

Example after logging in as a student:

```bash
curl -X POST http://127.0.0.1:4000/chatbot/student/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <student-token>" \
  -d '{"question":"Cfare eshte nje thyes ne matematike?"}'
```

The answer engine is in `apps/api/src/student-chat/student-chat.ai.ts`. It uses Anthropic by default through `ANTHROPIC_API_KEY`, the same key family used by the teacher lesson-generation provider. The system prompt acts like a small tutoring/structuring agent: it keeps the answer Mathematics-only, student-friendly, clear, and avoids solving full exercises directly.

For offline development only, `STUDENT_CHAT_PROVIDER="local"` keeps the endpoint available without an API key, but that is not the real chatbot mode.

## Phase 4 Teacher Assistant

The teacher assistant backend lives in one small NestJS module: `apps/api/src/teacher-assistant`. It is teacher-only and connects the logged-in teacher flow to the existing Amathint Ditare generator.

Teacher assistant endpoints:

```text
POST /teacher-assistant/ditare     Create/generate a Ditare from a teacher message
GET  /teacher-assistant/runs       List the teacher's recent generation runs
GET  /teacher-assistant/runs/:id   Read one generation run
```

Example after logging in as a teacher:

```bash
curl -X POST http://127.0.0.1:4000/teacher-assistant/ditare \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <teacher-token>" \
  -d '{"message":"Dua te gjeneroj ditare per MAT7_001","provider":"fake","force":true,"render":true}'
```

For real AI generation, use:

```bash
TEACHER_DITARE_PROVIDER="anthropic"
ANTHROPIC_API_KEY="your-anthropic-key"
```

For local development, `TEACHER_DITARE_PROVIDER="fake"` generates deterministic Ditare output without an API key.

## Phase 5 Simple React UI

The first web UI lives in `apps/web`. It is intentionally simple:

```text
Landing page
Sign up / sign in
Role-based dashboard shell
Student Math Q/A chatbot page
Teacher Ditare assistant page
```

Run the UI:

```bash
cd apps/web
npm install
npm run dev
```

The UI expects the NestJS API at `http://127.0.0.1:4000`. To point it somewhere else, set:

```bash
VITE_API_BASE="http://127.0.0.1:4000"
```

The analytics/dashboard diagrams are intentionally left for the next UI phase.

## API Service

The API is deliberately local and thin. It is meant for a future UI or the thesis AI project to consume clean artifacts without reaching into internal scripts.

Main endpoints:

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

Example API calls after starting the server:

```bash
curl http://127.0.0.1:8000/health
curl "http://127.0.0.1:8000/catalog/topics?subject=matematike&grade=7&limit=2"
curl -X POST http://127.0.0.1:8000/lessons/render \
  -H "Content-Type: application/json" \
  -d '{"lesson_id":"MAT7_001","force":true}'
```

## Validation Rules

Amathint fails incomplete output before it becomes trusted material.

JSON validation checks that required canonical fields are present and non-empty:

- subject and class
- topic and lesson metadata
- keywords
- cross-curricular links
- main lesson body
- homework
- generation metadata

DOCX validation checks the rendered table:

- row 0 includes subject and class information
- row 2 has keywords/results content
- row 3 has resources/cross-curricular content
- row 5 has a substantial lesson body
- row 6 has homework
- the file can be opened with `python-docx`

## Providers

Two providers exist in V1:

- `fake`: deterministic offline provider for tests, demos, sample gates, and development
- `anthropic`: real LLM provider using `ANTHROPIC_API_KEY`

Provider adapters all return raw JSON-like lesson data. The normalizer and validator decide whether that data is acceptable for the pipeline.

## Recommended Workflow

For development:

```bash
./amathint catalog build
./amathint run-sample-gate --force
PYTHONPATH=src python3 -m pytest -q
```

For a small real generation batch:

```bash
export ANTHROPIC_API_KEY="..."
./amathint generate --subject matematike --grade 7 --limit 10 --provider anthropic
./amathint render --all
./amathint validate all
./amathint index build
```

For full generation, run Mathematics by grade instead of all at once. Existing valid JSON is not overwritten unless `--force` is used.

## Handoff To The Thesis AI

The thesis AI should consume:

- `data/catalog/curriculum_catalog.json`
- `data/generated/lessons_json/`
- `outputs/indexes/index.json`
- original source files under `data/sources/`

It should not treat rendered DOCX files as the knowledge base. DOCX is for teachers and reporting. JSON and source documents are for retrieval, citations, and structured reasoning.

Recommended split:

```text
Amathint
  creates clean curriculum topic data
  creates canonical lesson plans
  renders teacher-facing Word reports
  exposes indexes and local API endpoints

Thesis AI
  ingests curriculum/source documents
  ingests canonical lesson JSON
  performs retrieval and Q&A
  cites curriculum/source refs
  optionally requests Amathint to generate or render reports
```

## Troubleshooting

If imports fail, run commands with:

```bash
PYTHONPATH=src python3 -m ditare.cli --help
```

If the local virtual environment was moved between folders and no longer works, use the checked-in launcher scripts first:

```bash
./amathint --help
```

If Anthropic generation fails, confirm the environment variable is set:

```bash
echo "$ANTHROPIC_API_KEY"
```

If a DOCX is missing but JSON exists:

```bash
./amathint render --lesson-id MAT7_001 --force
```

If the index looks stale:

```bash
./amathint index build
```
