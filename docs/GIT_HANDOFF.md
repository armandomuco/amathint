# Git Handoff Guide

This project is prepared to live in Git as **Amathint**.

## What Should Be Tracked

Track:

```text
src/                         Pipeline code
tests/                       Automated tests
docs/                        Operating and handoff docs
README.md
AMATHINT_HANDOFF_PLAN.md
pyproject.toml
requirements.txt
amathint                    Main CLI launcher
ditare                       Compatibility CLI alias
data/catalog/                Cleaned curriculum catalog
data/sources/                Ministry/source and teacher reference docs
data/generated/lessons_json/ Canonical generated lesson JSON
outputs/indexes/             Search/status indexes
```

Ignore:

```text
.env
venv/
__pycache__/
.pytest_cache/
outputs/amathint_docx/```

Rendered DOCX reports are intentionally ignored because they can be recreated from canonical JSON:

```bash
./amathint render --all
```

## First Push

Create an empty repository in GitHub/GitLab/Bitbucket first. Do not initialize it with a README because this project already has one.

Then from this folder:

```bash
git remote add origin git@github.com:YOUR_ORG_OR_USER/amathint.git
git branch -M main
git push -u origin main
```

If using HTTPS instead of SSH:

```bash
git remote add origin https://github.com/YOUR_ORG_OR_USER/amathint.git
git branch -M main
git push -u origin main
```

After pushing, invite the colleague from the repository settings page.

## Fresh Clone Setup

```bash
git clone git@github.com:YOUR_ORG_OR_USER/amathint.git
cd amathint
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Add the real key to `.env` only on the local machine:

```text
ANTHROPIC_API_KEY=...
```

Run the local smoke test:

```bash
./amathint --help
./amathint catalog build
./amathint run-sample-gate --force
./amathint validate all
./amathint index build
PYTHONPATH=src python3 -m pytest -q
```

## Daily Workflow

Generate offline samples:

```bash
./amathint generate --subject matematike --grade 7 --limit 5 --provider fake
./amathint render --all
./amathint validate all
./amathint index build
```

Generate with Anthropic:

```bash
export ANTHROPIC_API_KEY="..."
./amathint generate --lesson-id MAT7_001 --provider anthropic
```

Run the local API:

```bash
./amathint api serve --host 127.0.0.1 --port 8000
```

## Safety Notes

- Never commit `.env`.
- If a secret is accidentally committed, rotate it before pushing.
- Use Git LFS for future source files larger than normal GitHub limits.
- Keep generated DOCX reports out of Git unless there is a deliberate release/package reason.
- The thesis AI should consume canonical JSON and source files, not rendered Word reports.
