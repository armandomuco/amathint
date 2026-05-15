"""Provider adapters for lesson generation."""

from __future__ import annotations

import json
import os
import re
from abc import ABC, abstractmethod
from typing import Any

from ditare.generation.schema import PROMPT_VERSION, SUBJECTS


class LessonProvider(ABC):
    name = "base"

    def __init__(self, model: str = ""):
        self.model = model

    @abstractmethod
    def generate(self, topic: dict[str, Any]) -> dict[str, Any]:
        """Generate raw lesson JSON for a catalog topic."""


def build_prompt(topic: dict[str, Any]) -> str:
    return f"""Krijo një plan mësimor Ditare në gjuhën shqipe dhe kthe vetëm JSON.

Skema:
{{
  "id": "{topic['id']}",
  "subject": "{topic['subject']}",
  "subject_full": "{topic['subject_full']}",
  "grade": {topic['grade']},
  "shkalla": "{topic['shkalla']}",
  "lesson_number": {topic['lesson_number']},
  "tema": "{topic['tema']}",
  "tematika": "{topic['tematika']}",
  "month": "{topic['month']}",
  "trimester": {topic['trimester']},
  "duration_minutes": 45,
  "situata": "situatë konkrete të nxëni",
  "rezultatet": ["5-6 rezultate të matshme"],
  "fjalet_kyce": ["6-8 terma"],
  "burimet": ["5-6 burime konkrete"],
  "lidhja": "lidhje ndërkurrikulare",
  "metodologjia": {{
    "qellimi": "...",
    "evokim": "...",
    "realizim_kuptimi": "...",
    "praktike": "...",
    "reflektim": "...",
    "vleresim": "...",
    "nxenes_ak": "..."
  }},
  "detyrat": {{
    "baze": "...",
    "krijuese": "...",
    "shtese": "..."
  }}
}}

Kërkesa: organizimi të jetë i detajuar, praktik, 45 minuta, me ERR, me shembuj konkretë dhe kontekst shqiptar.
Prompt version: {PROMPT_VERSION}
"""


class FakeProvider(LessonProvider):
    """Deterministic provider used for tests, sample gate, and offline demos."""

    name = "fake"

    def __init__(self, model: str = "fake-v1"):
        super().__init__(model=model)

    def generate(self, topic: dict[str, Any]) -> dict[str, Any]:
        tema = topic["tema"]
        grade = topic["grade"]
        subject = topic["subject"]
        subject_full = topic["subject_full"]
        subject_focus = {
            "matematike": "zgjidhje problemash me numra dhe arsyetim logjik",
        }.get(subject, "punë praktike")

        return {
            "id": topic["id"],
            "subject": subject,
            "subject_full": subject_full,
            "grade": grade,
            "shkalla": topic["shkalla"],
            "lesson_number": topic["lesson_number"],
            "tema": tema,
            "tematika": topic["tematika"],
            "month": topic["month"],
            "trimester": topic["trimester"],
            "duration_minutes": 45,
            "situata": (
                f"Nxënësit e klasës {grade} analizojnë temën '{tema}' në një situatë të njohur "
                f"shkollore në Shqipëri. Ata punojnë me shembuj konkretë, diskutojnë në grupe "
                f"dhe lidhin njohuritë me jetën e përditshme."
            ),
            "rezultatet": [
                f"Nxënësi/ja përkufizon konceptet kryesore të temës '{tema}'.",
                f"Nxënësi/ja identifikon shembuj konkretë që lidhen me '{tema}'.",
                f"Nxënësi/ja zbaton njohuritë e reja në ushtrime të drejtuara.",
                f"Nxënësi/ja argumenton hapat e zgjidhjes me gjuhë të qartë.",
                f"Nxënësi/ja bashkëpunon në grup për të zgjidhur një detyrë praktike.",
            ],
            "fjalet_kyce": topic.get("keywords")
            or [tema, topic["tematika"], subject_full, "ushtrim", "zbatim", "vlerësim"],
            "burimet": [
                f"Libri i nxënësit - {subject_full} {grade}",
                "Fletore pune dhe fletë ushtrimesh",
                "Tabela e klasës dhe markera",
                "Materiale të përgatitura nga mësuesi",
                "Shembuj nga jeta e përditshme në Shqipëri",
            ],
            "lidhja": (
                f"Lidhet me gjuhën shqipe për shpjegimin e qartë të mendimit, me qytetarinë "
                f"për bashkëpunimin në grup dhe me teknologjinë për përdorimin e mjeteve "
                f"ndihmëse gjatë temës '{tema}'."
            ),
            "metodologjia": {
                "qellimi": (
                    f"Qëllimi i orës është që nxënësit të ndërtojnë kuptim të qëndrueshëm për "
                    f"'{tema}' dhe ta përdorin këtë njohuri në situata praktike. Mësimi fokusohet "
                    f"te {subject_focus}."
                ),
                "evokim": (
                    f"8-10 minuta: Mësuesi paraqet një pyetje hyrëse për temën '{tema}' dhe kërkon "
                    f"nga nxënësit të japin shembuj nga përvoja e tyre. Nxënësit punojnë në dyshe, "
                    f"shkruajnë dy ide në fletore dhe i ndajnë me klasën. Mësuesi lidh përgjigjet "
                    f"me njohuritë e orës së kaluar dhe shpall rezultatet e pritshme."
                ),
                "realizim_kuptimi": (
                    f"25-28 minuta: Mësuesi shpjegon konceptin kryesor të '{tema}' me tre shembuj "
                    f"të zgjidhur hap pas hapi në tabelë. Shembulli 1 është i thjeshtë dhe kontrollon "
                    f"kuptimin bazë; Shembulli 2 kërkon zbatim në një situatë shkollore; Shembulli 3 "
                    f"kërkon arsyetim dhe krahasim strategjish. Nxënësit ndahen në grupe me role: "
                    f"lexuesi i kërkesës, zgjidhësi, kontrolluesi dhe prezantuesi. Çdo grup merr një "
                    f"detyrë të lidhur me '{tema}', diskuton hapat, verifikon përgjigjen dhe përgatit "
                    f"një prezantim të shkurtër. Mësuesi qarkullon, bën pyetje orientuese, ndihmon "
                    f"nxënësit që kanë vështirësi dhe nxit nxënësit e avancuar të gjejnë një mënyrë "
                    f"tjetër zgjidhjeje."
                ),
                "praktike": (
                    "8-10 minuta: Niveli bazë përfshin 3 ushtrime të drejtpërdrejta. Niveli mesatar "
                    "përfshin 2 situata problemore me dy hapa. Niveli i avancuar përfshin një problem "
                    "sfidues ku nxënësi duhet të shpjegojë arsyetimin. Nxënësit zgjedhin nivelin e parë "
                    "me mbështetjen e mësuesit dhe mund të kalojnë në nivel më të lartë kur përfundojnë."
                ),
                "reflektim": (
                    f"3-5 minuta: Klasa përmbledh tre gjërat më të rëndësishme për '{tema}'. "
                    f"Mësuesi bën një kontroll të shpejtë me pyetje verbale dhe kërkon nga nxënësit "
                    f"të plotësojnë fjalinë: 'Sot mësova se...'. Në fund prezantohet lidhja me orën "
                    f"e ardhshme."
                ),
                "vleresim": (
                    "Vlerësimi bëhet përmes vëzhgimit gjatë punës në grup, përgjigjeve në tabelë, "
                    "saktësisë së ushtrimeve dhe aftësisë për të shpjeguar hapat. Kriteret janë: "
                    "identifikon konceptin, zbaton procedurën, argumenton përgjigjen dhe bashkëpunon."
                ),
                "nxenes_ak": (
                    "Për nxënësit me vështirësi përdoren shembuj më të thjeshtë, fletë pune me hapa, "
                    "kohë shtesë dhe mbështetje nga një shok i grupit. Për nxënësit e avancuar jepet "
                    "një detyrë sfiduese me kërkesë për argumentim."
                ),
            },
            "detyrat": {
                "baze": f"Zgjidhni 4 ushtrime bazë që lidhen me temën '{tema}' nga fleta e punës.",
                "krijuese": f"Gjeni një shembull nga jeta e përditshme ku përdoret '{tema}' dhe përshkruajeni me 5 fjali.",
                "shtese": f"Përgatitni një problem shtesë për '{tema}' dhe sillni zgjidhjen në orën tjetër.",
            },
        }


class AnthropicProvider(LessonProvider):
    name = "anthropic"

    def __init__(self, model: str = "claude-sonnet-4-20250514", api_key: str | None = None):
        super().__init__(model=model)
        self.api_key = api_key or os.environ.get("ANTHROPIC_API_KEY")
        if not self.api_key:
            raise RuntimeError("ANTHROPIC_API_KEY is required for the Anthropic provider.")
        try:
            import anthropic
        except ImportError as exc:
            raise RuntimeError("Install anthropic to use the Anthropic provider.") from exc
        self.client = anthropic.Anthropic(api_key=self.api_key)

    def generate(self, topic: dict[str, Any]) -> dict[str, Any]:
        message = self.client.messages.create(
            model=self.model,
            max_tokens=4096,
            system="Ti je mësues ekspert në Shqipëri. Kthe vetëm JSON të vlefshëm.",
            messages=[{"role": "user", "content": build_prompt(topic)}],
        )
        text = message.content[0].text
        if not text.strip().startswith("{"):
            match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
            if match:
                text = match.group(1)
        return json.loads(text)


def get_provider(name: str = "fake", model: str | None = None) -> LessonProvider:
    if name == "fake":
        return FakeProvider(model or "fake-v1")
    if name == "anthropic":
        return AnthropicProvider(model or "claude-sonnet-4-20250514")
    raise ValueError(f"Unknown provider: {name}")
