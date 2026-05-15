export type QuestionInsights = {
  mathKeyword: string;
  riskLevel: "low" | "medium" | "high";
  riskScore: number;
};

const KEYWORD_RULES = [
  { keyword: "Thyesat", terms: ["thyes", "numerator", "denominator", "emerues", "numërues"] },
  { keyword: "Përqindja", terms: ["përqind", "perqind", "percent", "%"] },
  { keyword: "Ekuacionet", terms: ["ekuacion", "equation", "x", "ndryshore", "unknown"] },
  { keyword: "Gjeometria", terms: ["gjeometri", "figur", "trekend", "trekënd", "katror", "drejtkend", "drejtkënd"] },
  { keyword: "Këndet", terms: ["kend", "kënd", "angle", "grade", "90"] },
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
  { keyword: "Formulat", terms: ["formul", "formula", "syprinë", "syprine", "vëllim", "vellim"] }
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
  const text = question.toLowerCase();
  const matched = KEYWORD_RULES.find((rule) => rule.terms.some((term) => text.includes(term.toLowerCase())));
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
