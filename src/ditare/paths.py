"""Shared filesystem paths for Amathint."""

from __future__ import annotations

from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]

DATA_DIR = PROJECT_ROOT / "data"
CATALOG_DIR = DATA_DIR / "catalog"
GENERATED_DIR = DATA_DIR / "generated"
LESSONS_JSON_DIR = GENERATED_DIR / "lessons_json"
VALIDATION_REPORTS_DIR = GENERATED_DIR / "validation_reports"

OUTPUTS_DIR = PROJECT_ROOT / "outputs"
DITARE_DOCX_DIR = OUTPUTS_DIR / "amathint_docx"
INDEXES_DIR = OUTPUTS_DIR / "indexes"

DEFAULT_CATALOG_PATH = CATALOG_DIR / "curriculum_catalog.json"
DEFAULT_INDEX_JSON = INDEXES_DIR / "index.json"
DEFAULT_INDEX_XLSX = INDEXES_DIR / "index.xlsx"


def ensure_runtime_dirs() -> None:
    """Create the runtime directories used by the new pipeline."""
    for path in [
        CATALOG_DIR,
        LESSONS_JSON_DIR,
        VALIDATION_REPORTS_DIR,
        DITARE_DOCX_DIR,
        INDEXES_DIR,
    ]:
        path.mkdir(parents=True, exist_ok=True)


def find_catalog_input(explicit: str | Path | None = None) -> Path:
    """Find the best available source catalog."""
    candidates = []
    if explicit:
        candidates.append(Path(explicit))
    candidates.extend(
        [
            DEFAULT_CATALOG_PATH,
            PROJECT_ROOT / "curriculum_full_catalog.json",
        ]
    )
    for candidate in candidates:
        if candidate.exists():
            return candidate
    raise FileNotFoundError("No curriculum catalog found.")
