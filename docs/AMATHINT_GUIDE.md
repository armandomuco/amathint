# Amathint Operating Guide

This guide explains how to run, extend, and hand off Amathint.

Amathint is the product name. Ditare is the Albanian lesson-report format produced by the renderer.

## Mental Model

Amathint is a pipeline, not a monolithic script.

```text
catalog topic
  -> generation provider
  -> raw lesson object
  -> normalizer
  -> canonical JSON
  -> DOCX renderer
  -> validators
  -> indexes
```

Each step leaves a useful artifact behind. That is intentional. If DOCX rendering fails, the generated JSON can be inspected. If an AI response is weak, the canonical JSON and source refs can be reviewed. If the index is stale, it can be rebuilt without regenerating lessons.

## First Run

From the repository root:

```bash
./amathint --help
./amathint catalog build
./amathint run-sample-gate --force
./amathint validate all
./amathint index build
```

Expected outcome:

- `data/catalog/curriculum_catalog.json` exists
- several canonical lesson JSON files exist under `data/generated/lessons_json/`
- matching Word documents exist under `outputs/amathint_docx/`
- `outputs/indexes/index.json` and `outputs/indexes/index.xlsx` exist
- validation reports `Failed: 0`

## Important Folders

### `data/sources/`

Long-lived source material and reference examples. This is where ministry documents and teacher samples belong.

### `data/catalog/`

The cleaned curriculum topic catalog. This is the stable list of topics that generation runs against.

### `data/generated/lessons_json/`

Canonical lesson JSON. This is the most important generated output because every other downstream artifact can be rebuilt from it.

### `outputs/amathint_docx/`

Teacher-facing Word reports. These are useful for everyday school work, but should not be treated as the source of truth for AI retrieval.

### `outputs/indexes/`

Searchable status indexes. `index.json` is best for code. `index.xlsx` is best for quick human review.

## Catalog Workflow

Build the catalog:

```bash
./amathint catalog build
```

The builder starts from the best available catalog input, cleans the topic records, and writes:

```text
data/catalog/curriculum_catalog.json
```

The catalog is a list of curriculum topics. Each topic has fields such as:

```text
id
subject
subject_full
grade
lesson_number
tema
tematika
month
trimester
source_refs
```

Generation uses these topics as the input plan.

## Generation Workflow

Generate a small deterministic batch without an API key:

```bash
./amathint generate --subject matematike --grade 7 --limit 5 --provider fake
```

Generate one specific lesson:

```bash
./amathint generate --lesson-id MAT7_001 --provider fake --force
```

Generate through Anthropic:

```bash
export ANTHROPIC_API_KEY="..."
./amathint generate --lesson-id MAT7_001 --provider anthropic
```

The generation step writes canonical JSON. It does not need to render DOCX immediately.

## Rendering Workflow

Render a single lesson:

```bash
./amathint render --lesson-id MAT7_001 --force
```

Render all available canonical JSON files:

```bash
./amathint render --all
```

The renderer uses the canonical JSON schema only. If old fields appear in imported material, they are normalized first.

## Validation Workflow

Validate only JSON:

```bash
./amathint validate json
```

Validate only DOCX:

```bash
./amathint validate docx
```

Validate both:

```bash
./amathint validate all
```

Validation is intentionally strict around the visible teacher report cells. It fails blank or thin content for:

```text
subject/class
topic
keywords
cross-curricular links
main lesson body
homework
generation metadata
```

## Index Workflow

Build indexes:

```bash
./amathint index build
```

Outputs:

```text
outputs/indexes/index.json
outputs/indexes/index.xlsx
```

Each index row records:

```text
lesson id
subject
grade
lesson number
topic
JSON path
DOCX path
JSON validity
DOCX validity
validation errors
```

This is the easiest handoff artifact for a UI, dashboard, or thesis AI ingestion job.

## Sample Gate

Before a full run, execute:

```bash
./amathint run-sample-gate --force
```

The sample gate:

1. loads the catalog
2. picks representative lessons
3. generates with the selected provider
4. normalizes and validates JSON
5. renders DOCX
6. validates DOCX
7. rebuilds indexes

Run this whenever prompt/provider/schema changes are made.

## Provider Adapters

Provider adapters live in:

```text
src/ditare/generation/providers.py
```

Current providers:

```text
fake       deterministic, local, no API key
anthropic  real LLM provider, requires ANTHROPIC_API_KEY
```

A provider should return a raw lesson object. It does not need to perfectly match the canonical schema, because the normalizer handles known variants. It should still try to provide complete content because validators reject weak output.

To add another provider:

1. implement a provider class with `name`, `model`, and `generate(topic)`
2. register it in `get_provider`
3. add tests using the fake-provider pattern
4. run the sample gate

## API Workflow

Start the API:

```bash
./amathint api serve --host 127.0.0.1 --port 8000
```

Health check:

```bash
curl http://127.0.0.1:8000/health
```

List topics:

```bash
curl "http://127.0.0.1:8000/catalog/topics?subject=matematike&grade=7&limit=2"
```

Generate:

```bash
curl -X POST http://127.0.0.1:8000/lessons/generate \
  -H "Content-Type: application/json" \
  -d '{"lesson_id":"MAT7_001","provider":"fake","force":true}'
```

Render:

```bash
curl -X POST http://127.0.0.1:8000/lessons/render \
  -H "Content-Type: application/json" \
  -d '{"lesson_id":"MAT7_001","force":true}'
```

Validate:

```bash
curl -X POST http://127.0.0.1:8000/validation/run \
  -H "Content-Type: application/json" \
  -d '{"lesson_id":"MAT7_001","target":"all"}'
```

Fetch canonical JSON:

```bash
curl "http://127.0.0.1:8000/artifacts/MAT7_001?artifact_type=json"
```

Fetch DOCX:

```bash
curl -o MAT7_001.docx http://127.0.0.1:8000/artifacts/MAT7_001
```

## Full Generation Strategy

Do not start by generating all topics in one run. Use subject/grade batches:

```bash
export ANTHROPIC_API_KEY="..."
./amathint generate --subject matematike --grade 7 --limit 20 --provider anthropic
./amathint render --all
./amathint validate all
./amathint index build
```

Then increase the limit or move to another grade.

Existing valid JSON is skipped unless `--force` is passed. That makes interrupted runs resumable.

## Review Process

For teacher review, use the spreadsheet:

```text
outputs/indexes/index.xlsx
```

Suggested manual review rhythm:

```text
Generate 20 lessons
Review 3 to 5 with the teacher
Record issues by lesson id
Adjust prompt/schema/provider if needed
Regenerate only affected lessons with --force
Rebuild indexes
```

Common review categories:

```text
missing curriculum link
weak activity
too generic
wrong grade level
homework too vague
language/style issue
teacher correction accepted
```

## Thesis AI Handoff

The thesis AI should consume these inputs:

```text
data/sources/
data/catalog/curriculum_catalog.json
data/generated/lessons_json/
outputs/indexes/index.json
```

Recommended AI separation:

```text
Amathint
  curriculum topic management
  structured lesson generation
  DOCX report rendering
  validation and indexes
  local API

Thesis AI
  source document ingestion
  retrieval
  teacher/student Q&A
  citation checks
  optional calls into Amathint API
```

The AI should cite source material. It can use generated lesson JSON as teaching context, but should not treat generated content as ministry truth unless it is grounded by `source_refs`.

## Testing

Run the test suite:

```bash
PYTHONPATH=src python3 -m pytest -q
```

Core test coverage:

```text
normalizer maps old schema variants
validator rejects incomplete lessons
fake provider runs deterministically
renderer creates openable DOCX
indexes build from canonical JSON
API health/generate/render/validate flows work
```

## Troubleshooting

### `ModuleNotFoundError: ditare`

Use:

```bash
PYTHONPATH=src python3 -m ditare.cli --help
```

or run through:

```bash
./amathint --help
```

### Anthropic key missing

Set:

```bash
export ANTHROPIC_API_KEY="..."
```

Then retry generation.

### DOCX exists but validation says stale content

Regenerate from canonical JSON:

```bash
./amathint render --lesson-id MAT7_001 --force
```

### JSON exists but DOCX is missing

Run:

```bash
./amathint render --all
```

### Index counts look wrong

Run:

```bash
./amathint index build
```
