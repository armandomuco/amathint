import { Injectable, ServiceUnavailableException } from "@nestjs/common";

type ChatHistoryMessage = {
  role: string;
  content: string;
};

type StudentChatAnswer = {
  content: string;
  provider: string;
  model: string;
};

const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-20250514";
const LOCAL_MODEL = "local-guided-v3";

const SYSTEM_PROMPT = [
  "You are Amathint Student Math Q/A Chatbot.",
  "You help Albanian school students understand Mathematics.",
  "You answer in simple Albanian unless the student asks in another language.",
  "Before answering, interpret Albanian school math wording and common missing accents, for example siperfaqe/sipërfaqe, trekendesh/trekëndësh, sfere/sferë, vellim/vëllim.",
  "You only answer Mathematics questions. If the student asks about another subject, politely explain that this chatbot is only for Math Q/A.",
  "You do not solve full homework/exam exercises directly.",
  "If the student asks to solve an exercise, explain the concept and ask which step is confusing.",
  "Answer naturally like a friendly tutor in a chat. Do not force numbered sections.",
  "Give the exact concept, formula, or explanation the student asks for, with enough detail to understand it.",
  "Use a small example only when it helps. End with one short follow-up question if useful."
].join("\n");

@Injectable()
export class StudentChatAiService {
  async answer(question: string, history: ChatHistoryMessage[]): Promise<StudentChatAnswer> {
    const provider = (process.env.STUDENT_CHAT_PROVIDER || "anthropic").toLowerCase();
    const normalizedQuestion = this.normalize(question);

    if (!this.isGreeting(normalizedQuestion) && !this.isMathQuestion(normalizedQuestion)) {
      return {
        content:
          "Ky chatbot eshte vetem per pyetje dhe pergjigje ne Matematike. Mund te me pyesesh per formula, koncepte, gjeometri, algjeber, funksione, probabilitet ose tema te tjera matematikore.",
        provider: "local",
        model: LOCAL_MODEL
      };
    }

    if (provider === "anthropic") {
      return this.answerWithAnthropic(question, history);
    }

    if (provider === "local") {
      return this.answerWithLocalFallback(question);
    }

    throw new ServiceUnavailableException(`Unsupported student chat provider: ${provider}`);
  }

  private async answerWithAnthropic(question: string, history: ChatHistoryMessage[]): Promise<StudentChatAnswer> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const model = process.env.STUDENT_CHAT_MODEL || DEFAULT_ANTHROPIC_MODEL;

    if (!apiKey) {
      throw new ServiceUnavailableException("ANTHROPIC_API_KEY is required for the student chatbot.");
    }

    const messages = [
      ...history.slice(-10).map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: message.content
      })),
      { role: "user", content: question }
    ];

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model,
        max_tokens: 700,
        system: SYSTEM_PROMPT,
        messages
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = typeof data?.error?.message === "string" ? data.error.message : "Anthropic request failed.";
      throw new ServiceUnavailableException(message);
    }

    const content = Array.isArray(data.content)
      ? data.content
          .filter((item: { type?: string; text?: string }) => item.type === "text" && item.text)
          .map((item: { text: string }) => item.text)
          .join("\n")
          .trim()
      : "";

    if (!content) {
      throw new ServiceUnavailableException("Anthropic returned an empty chatbot answer.");
    }

    return {
      content,
      provider: "anthropic",
      model
    };
  }

  private answerWithLocalFallback(question: string): StudentChatAnswer {
    const lower = this.normalize(question);

    if (this.isGreeting(lower)) {
      return {
        content: "Pershendetje! Si mund te te ndihmoj me Matematiken sot? Mund te pyesesh per nje koncept, formule, rregull ose metode.",
        provider: "local",
        model: LOCAL_MODEL
      };
    }

    if (!this.isMathQuestion(lower)) {
      return {
        content:
          "Ky chatbot eshte vetem per pyetje dhe pergjigje ne Matematike. Mund te me pyesesh per formula, koncepte, gjeometri, algjeber, funksione, probabilitet ose tema te tjera matematikore.",
        provider: "local",
        model: LOCAL_MODEL
      };
    }

    if (/\d/.test(lower) && ["zgjidh", "solve", "llogarit", "calculate"].some((word) => lower.includes(word))) {
      return {
        content:
          "Mund te te ndihmoj ta kuptosh menyren, por nuk do ta zgjidh ushtrimin komplet ne vendin tend. Me trego cilin hap nuk kupton: cfare formule duhet perdorur, si fillon zgjidhja, apo si kontrollohet rezultati? Pastaj mund ta shpjegojme me nje shembull me te thjeshte.",
        provider: "local",
        model: LOCAL_MODEL
      };
    }

    const formulaAnswer = this.findFormulaAnswer(lower);
    if (formulaAnswer) {
      return {
        content: formulaAnswer,
        provider: "local",
        model: LOCAL_MODEL
      };
    }

    const concept = this.findConcept(lower);
    if (concept) {
      return {
        content: concept,
        provider: "local",
        model: LOCAL_MODEL
      };
    }

    return {
      content: this.answerGeneralMathQuestion(question),
      provider: "local",
      model: LOCAL_MODEL
    };
  }

  private normalize(value: string) {
    return value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9%]+/g, " ")
      .trim();
  }

  private hasAny(question: string, terms: string[]) {
    return terms.some((term) => question.includes(this.normalize(term)));
  }

  private findFormulaAnswer(question: string) {
    const asksFormulaOrMeasure = this.hasAny(question, [
      "formul",
      "formula",
      "siperfaq",
      "syprin",
      "perimeter",
      "perimet",
      "vellim",
      "volum"
    ]);

    if (!asksFormulaOrMeasure) {
      return null;
    }

    if (this.hasAny(question, ["trekend", "trekendeshi", "trekendeshit", "triangle"])) {
      return "Për sipërfaqen e trekëndëshit përdoret formula S = (baza × lartësia) / 2. Baza është brinja që zgjedhim si bazë, ndërsa lartësia është segmenti pingul që bie mbi atë bazë. Pjesëtohet me 2 sepse një trekëndësh mund të shihet si gjysma e një paralelogrami ose drejtkëndëshi me të njëjtën bazë dhe lartësi.";
    }

    if (this.hasAny(question, ["trapez", "trapezi", "trapezit", "trapezoid"])) {
      return "Për sipërfaqen e trapezit përdoret formula S = ((B + b) × h) / 2. Këtu B dhe b janë dy bazat paralele të trapezit, ndërsa h është lartësia pingule midis tyre. Fillimisht mblidhen dy bazat, pastaj shumëzohen me lartësinë dhe në fund pjesëtohet me 2.";
    }

    if (this.hasAny(question, ["sfere", "sfera", "sferes", "sphere"])) {
      if (this.hasAny(question, ["vellim", "volum"])) {
        return "Për vëllimin e sferës përdoret formula V = 4/3 × π × r³. Këtu r është rrezja e sferës, pra largësia nga qendra deri në sipërfaqe. Simboli π është afërsisht 3.14.";
      }
      return "Sfera është trup gjeometrik 3D ku çdo pikë e sipërfaqes është në të njëjtën largësi nga qendra. Për sipërfaqen e sferës përdoret formula S = 4 × π × r², ku r është rrezja. Nëse kërkohet vëllimi, formula është V = 4/3 × π × r³.";
    }

    if (this.hasAny(question, ["rreth", "rrethi", "circle"])) {
      return "Për sipërfaqen e rrethit përdoret formula S = π × r², ku r është rrezja e rrethit. Për perimetrin, pra gjatësinë rrethore, përdoret P = 2 × π × r. Simboli π është afërsisht 3.14.";
    }

    if (this.hasAny(question, ["drejtkend", "drejtkendeshi", "rectangle"])) {
      return "Për sipërfaqen e drejtkëndëshit përdoret formula S = gjatësia × gjerësia. Për perimetrin përdoret P = 2 × (gjatësia + gjerësia).";
    }

    if (this.hasAny(question, ["katror", "katrori", "square"])) {
      return "Për sipërfaqen e katrorit përdoret formula S = a², ku a është gjatësia e brinjës. Për perimetrin përdoret P = 4a, sepse katrori ka katër brinjë të barabarta.";
    }

    if (this.hasAny(question, ["kuboid", "kuboidi", "faqeve te kuboidit"])) {
      return "Sipërfaqja e kuboidit gjendet me formulën S = 2(ab + ac + bc), ku a, b dhe c janë gjatësia, gjerësia dhe lartësia. Kuboidi ka nga dy faqe të barabarta për secilin çift përmasash: ab, ac dhe bc.";
    }

    if (this.hasAny(question, ["kub", "kubi"])) {
      return "Për kubin, sipërfaqja është S = 6a² sepse kubi ka 6 faqe katrore të barabarta. Vëllimi është V = a³, ku a është brinja e kubit.";
    }

    return null;
  }

  private findConcept(question: string) {
    const concepts: Array<{ terms: string[]; answer: string }> = [
      {
        terms: ["vektor", "vektori"],
        answer:
          "Vektori eshte nje madhesi qe ka gjatesi, drejtim dhe kah. Mund ta mendosh si nje shigjete: gjatesia e shigjetes tregon madhesine e vektorit, ndersa maja tregon kahun ku shkon. Per shembull, nese leviz 3 hapa djathtas, kjo mund te paraqitet me nje vektor me gjatesi 3 dhe kah djathtas. Nese leviz 3 hapa majtas, gjatesia mund te jete prape 3, por kahu ndryshon."
      },
      {
        terms: ["thyes", "thyesa", "thyese"],
        answer:
          "Thyesa tregon nje pjese te nje te tere. Te thyesa 1/2, numri poshte tregon ne sa pjese te barabarta eshte ndare e tera, ndersa numri lart tregon sa prej atyre pjeseve kemi marre. Per shembull, nese nje pice ndahet ne 4 pjese te barabarta dhe ti merr 1 pjese, ke marre 1/4 e pices."
      },
      {
        terms: ["perqind", "percent", "%"],
        answer:
          "Perqindja tregon sa pjese kemi nga 100 pjese. Pra 25% do te thote 25 nga 100, ose 25/100. Per shembull, nese 100 nxenes jane ne shkolle dhe 25 prej tyre jane ne biblioteke, atehere 25% e nxenesve jane ne biblioteke. Me fjale te thjeshta, perqindja eshte nje menyre per ta krahasuar nje pjese me 100."
      },
      {
        terms: ["ekuacion", "barazim", "x"],
        answer:
          "Ekuacioni eshte nje barazim ku ka nje vlere te panjohur. Shenja = tregon qe te dy anet duhet te kene te njejten vlere. Qellimi eshte te gjejme vleren qe e ben barazimin te vertete. Per shembull, te x + 2 = 5, po kerkojme numrin qe kur i shtojme 2 jep 5."
      },
      {
        terms: ["kend ", " kendi ", "angle"],
        answer:
          "Kendi tregon hapjen midis dy rrezeve ose dy vijave qe nisen nga e njejta pike. Sa me shume hapen vijat, aq me i madh eshte kendi. Kendet maten me grade. Per shembull, kendi i drejte eshte 90 grade, si cepi i nje flete katrore."
      },
      {
        terms: ["derivat", "derivati", "derivatet"],
        answer:
          "Derivati tregon sa shpejt ndryshon nje madhesi ne nje moment te caktuar. Ne grafik, mund ta mendosh si pjerrtesine e grafikut ne nje pike. Nese grafiku ngjitet shpejt, derivati eshte me i madh; nese grafiku eshte pothuajse i sheshte, derivati eshte afer zeros. Per shembull, nese pozicioni i nje makine ndryshon me kohen, derivati i pozicionit tregon shpejtesine e makines ne ate moment."
      },
      {
        terms: ["integral", "integrali", "integralet"],
        answer:
          "Integrali perdoret per te mbledhur shume ndryshime te vogla dhe shpesh lidhet me siperfaqen poshte nje grafiku. Nese derivati tregon sa shpejt ndryshon dicka ne nje moment, integrali ndihmon te kuptojme sa eshte grumbulluar gjithsej. Per shembull, nese grafiku tregon shpejtesine e nje makine ne kohe, integrali i shpejtesise ndihmon te gjejme sa rruge ka bere makina."
      },
      {
        terms: ["limit", "limiti", "limitet"],
        answer:
          "Limiti tregon se ciles vlere i afrohet nje shprehje ose funksion kur ndryshorja afrohet te nje numer i caktuar. Nuk na intereson gjithmone cfare ndodh fiks ne ate pike; shpesh na intereson vlera ku po afrohet funksioni nga afer. Per shembull, nese vlerat e nje funksioni afrohen gjithnje e me shume te 2, themi se limiti eshte 2."
      },
      {
        terms: ["matrice", "matrica", "matricat", "matrix"],
        answer:
          "Matrica eshte nje tabele me numra te vendosur ne rreshta dhe kolona. Ajo ndihmon te organizojme te dhena ose te kryejme veprime me shume numra ne menyre te rregullt. Per shembull, nje matrice 2 me 3 ka 2 rreshta dhe 3 kolona, pra ka 6 elemente gjithsej."
      },
      {
        terms: ["sinus", "cosinus", "kosinus", "tangent", "trigonometri"],
        answer:
          "Trigonometria studion lidhjen midis kendeve dhe brinjeve te trekendeshave. Sinusi, kosinusi dhe tangjenti jane raporte qe krahasojne brinjet e nje trekendeshi kenddrejte. Nese nje kend dhe nje brinje njihen, keto raporte mund te ndihmojne te gjejme brinje ose kende te tjera."
      },
      {
        terms: ["logarit", "logaritmi", "logaritmet", "logarithm"],
        answer:
          "Logaritmi tregon eksponentin qe duhet t'i japim nje baze per te marre nje numer. Per shembull, nese 10^2 = 100, atehere logaritmi me baze 10 i 100 eshte 2. Po ashtu, log10(1000) = 3 sepse 10^3 = 1000."
      },
      {
        terms: ["polinom", "polinomi", "polinomet"],
        answer:
          "Polinomi eshte nje shprehje algjebrike me terma qe permbajne numra, ndryshore dhe fuqi natyrore. Shembuj jane x + 3, 2x^2 - 5x + 1, ose x^3 + x. Te 2x^2 - 5x + 1 kemi tre terma: 2x^2, -5x dhe 1."
      },
      {
        terms: ["kuboid", "kuboidi", "siperfaqe kuboid", "syprine kuboid", "faqeve te kuboidit"],
        answer:
          "Siperfaqja e kuboidit gjendet duke mbledhur siperfaqet e te gjashte faqeve te tij. Nese gjatesia eshte a, gjeresia b dhe lartesia c, formula eshte S = 2(ab + ac + bc). Kjo ndodh sepse kuboidi ka nga dy faqe te barabarta per secilin cift dimensionesh: dy faqe me siperfaqe ab, dy faqe me siperfaqe ac dhe dy faqe me siperfaqe bc. Pra i mbledhim dhe i shumezojme me 2."
      },
      {
        terms: ["sfere", "sfera", "sferes", "sphere"],
        answer:
          "Sfera është trup gjeometrik 3D, si një top, ku çdo pikë e sipërfaqes është në të njëjtën largësi nga qendra. Kjo largësi quhet rreze. Për sipërfaqen e sferës përdoret S = 4πr², ndërsa për vëllimin përdoret V = 4/3πr³."
      },
      {
        terms: ["inekuacion", "pabarazi", "me i madh", "me i vogel"],
        answer:
          "Inekuacioni eshte si ekuacioni, por perdor shenja krahasimi si <, >, <= ose >=. Ne vend qe te kerkojme nje vlere qe e ben barazimin te vertete, kerkojme vlera qe e bejne krahasimin te vertete. Per shembull, x > 3 do te thote qe x mund te jete cdo numer me i madh se 3."
      }
    ];

    return concepts.find((concept) => concept.terms.some((term) => question.includes(term)))?.answer || null;
  }

  private answerGeneralMathQuestion(question: string) {
    const cleanQuestion = question.trim().replace(/\s+/g, " ");
    const topic = cleanQuestion.length > 80 ? `${cleanQuestion.slice(0, 77)}...` : cleanQuestion;

    return `Pyetja jote lidhet me kete ide matematike: "${topic}". Per ta kuptuar mire, fillo duke gjetur konceptin kryesor dhe formulen ose rregullin qe lidhet me te. Pastaj nda pyetjen ne: cfare dihet, cfare kerkohet dhe cila lidhje matematike i bashkon. Nese do, ma shkruaj edhe klasen ose temen ku e keni mesuar dhe une ta shpjegoj me nje shembull me te afert.`;
  }

  private isGreeting(question: string) {
    return /^(hi|hello|hey|pershendetje|tung|ckemi|c kemi|miremengjes|miredita|mirembrema)$/.test(question);
  }

  private isMathQuestion(question: string) {
    const mathTerms = [
      "matematike",
      "formul",
      "num",
      "thyes",
      "perqind",
      "ekuacion",
      "inekuacion",
      "funksion",
      "grafik",
      "gjeometri",
      "trekend",
      "katror",
      "drejtkend",
      "rreth",
      "kendi",
      "kende",
      "kendet",
      "sfere",
      "sfer",
      "siperfaqe",
      "siperfaq",
      "syprine",
      "vellim",
      "kub",
      "kuboid",
      "trapez",
      "piramid",
      "cilinder",
      "derivat",
      "integral",
      "limit",
      "matric",
      "sinus",
      "kosinus",
      "tangent",
      "logarit",
      "polinom",
      "probabilitet",
      "statistik",
      "mesatare",
      "raport",
      "perpjesetim",
      "algjeber"
    ];
    const tokens = new Set(question.split(/\s+/).filter(Boolean));
    return (
      mathTerms.some((term) => (term.length <= 5 ? tokens.has(term) : question.includes(term))) ||
      /[0-9]+\s*([+\-*/^=<>]|%)/.test(question)
    );
  }
}
