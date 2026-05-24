export type QuestionInsights = {
  mathKeyword: string;
  riskLevel: "low" | "medium" | "high";
  riskScore: number;
};

const KEYWORD_RULES = [
  { keyword: "Thyesat", terms: ["thyes", "numerator", "denominator", "emerues", "numërues"] },
  { keyword: "Përqindja", terms: ["përqind", "perqind", "percent", "%"] },
  { keyword: "Ekuacionet", terms: ["ekuacion", "equation", "x", "ndryshore", "unknown"] },
  { keyword: "Gjeometria", terms: ["gjeometri", "figur", "trekend", "trekënd", "katror", "drejtkend", "drejtkënd", "trapez", "sfere", "sferë", "sfera", "rreth"] },
  { keyword: "Këndet", terms: ["kendi", "kende", "kendet", "angle", "grade", "90"] },
  { keyword: "Raporti", terms: ["raport", "perpjesetim", "përpjesëtim", "ratio"] },
  { keyword: "Probabiliteti", terms: ["probabilitet", "probability", "mundesi", "mundësi"] },
  { keyword: "Statistika", terms: ["mesatare", "median", "mode", "moda", "statistik", "tabel"] },
  { keyword: "Funksionet", terms: ["funksion", "grafik", "koordinat", "function"] },
  { keyword: "Derivatet", terms: ["derivat", "derivati", "derivatet"] },
  { keyword: "Integralet", terms: ["integral", "integrali", "integralet"] },
  { keyword: "Limitet", terms: ["limit", "limiti", "limitet"] },
  { keyword: "Matricat", terms: ["matric", "matrice", "matrica", "matrix"] },
  { keyword: "Trigonometria", terms: ["sinus", "kosinus", "cosinus", "tangent", "trigonometri"] },
  { keyword: "Logaritmet", terms: ["logarit", "logarithm"] },
  { keyword: "Polinomet", terms: ["polinom", "polinomi", "polinomet"] },
  { keyword: "Formulat", terms: ["formul", "formula", "syprinë", "syprine", "siperfaqe", "sipërfaqe", "vëllim", "vellim", "volum", "kuboid", "kub"] }
];

const RISK_TERMS = [
  "nuk kuptoj",
  "nuk e kuptoj",
  "s'e kuptoj",
  "nuk di",
  "veshtire",
  "vështirë",
  "jam konfuz",
  "confused",
  "i don't understand",
  "dont understand",
  "help",
  "ndihme",
  "ndihmë"
];

export function analyzeQuestion(question: string): QuestionInsights {
  const text = normalize(question);
  if (!isLikelyMathQuestion(text) && !isGreeting(text)) {
    return {
      mathKeyword: "Jashtë Matematikës",
      riskLevel: "low",
      riskScore: 0
    };
  }
  const matched = KEYWORD_RULES.find((rule) => rule.terms.some((term) => text.includes(normalize(term))));
  const asksForSolving = /\d/.test(text) && ["zgjidh", "solve", "llogarit", "calculate"].some((term) => text.includes(term));
  const signalsConfusion = RISK_TERMS.some((term) => text.includes(term));
  const isVeryShort = text.length < 24;

  let riskScore = 20;
  if (signalsConfusion) riskScore += 45;
  if (asksForSolving) riskScore += 25;
  if (isVeryShort) riskScore += 10;
  if (!matched) riskScore += 10;
  riskScore = Math.min(100, riskScore);

  return {
    mathKeyword: matched?.keyword || "Të përgjithshme",
    riskLevel: riskScore >= 70 ? "high" : riskScore >= 45 ? "medium" : "low",
    riskScore
  };
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ë/g, "e")
    .trim();
}

function isGreeting(value: string) {
  return /^(hi|hello|hey|pershendetje|tung|ckemi|c kemi|miremengjes|miredita|mirembrema)$/.test(
    value.replace(/[^a-z0-9]+/g, " ").trim()
  );
}

function isLikelyMathQuestion(value: string) {
  const tokens = new Set(value.split(/\s+/).filter(Boolean));
  return (
    KEYWORD_RULES.some((rule) =>
      rule.terms.some((term) => {
        const normalizedTerm = normalize(term);
        return normalizedTerm.length <= 5 ? tokens.has(normalizedTerm) : value.includes(normalizedTerm);
      })
    ) || /[0-9]+\s*([+\-*/^=<>]|%)/.test(value)
  );
}
