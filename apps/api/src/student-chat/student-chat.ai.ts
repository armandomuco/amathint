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
const LOCAL_MODEL = "local-guided-v2";

const SYSTEM_PROMPT = [
  "You are Amathint Student Math Q/A Chatbot.",
  "You help Albanian school students understand Mathematics.",
  "You answer in simple Albanian unless the student asks in another language.",
  "You do not solve full homework/exam exercises directly.",
  "If the student asks to solve an exercise, explain the concept and ask which step is confusing.",
  "Keep answers structured, short, friendly, and age-appropriate.",
  "Use this answer structure when useful:",
  "1. Idea kryesore",
  "2. Shpjegim i thjeshte",
  "3. Shembull i vogel konceptual",
  "4. Pyetje kontrolli per nxenesin"
].join("\n");

@Injectable()
export class StudentChatAiService {
  async answer(question: string, history: ChatHistoryMessage[]): Promise<StudentChatAnswer> {
    const provider = (process.env.STUDENT_CHAT_PROVIDER || "anthropic").toLowerCase();

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

    if (/\d/.test(lower) && ["zgjidh", "solve", "llogarit", "calculate"].some((word) => lower.includes(word))) {
      return {
        content:
          "1. Idea kryesore\nUne mund te te ndihmoj te kuptosh menyren, por nuk do ta zgjidh ushtrimin komplet ne vendin tend.\n\n2. Shpjegim i thjeshte\nMe trego cilin hap nuk kupton: konceptin, formulen, apo fillimin e zgjidhjes.\n\n3. Shembull i vogel konceptual\nMund te marrim nje shembull te ngjashem me numra me te thjeshte dhe ta shpjegojme hap pas hapi.\n\n4. Pyetje kontrolli\nCili eshte hapi i pare qe mendon se duhet bere?",
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

  private findConcept(question: string) {
    const concepts: Array<{ terms: string[]; answer: string }> = [
      {
        terms: ["vektor", "vektori"],
        answer:
          "1. Idea kryesore\nVektori eshte nje madhesi qe ka dy gjera: drejtim dhe gjatesi. Shpesh tregon edhe kahun, pra nga cila ane shkon.\n\n2. Shpjegim i thjeshte\nMendo nje shigjete. Gjatësia e shigjetes tregon sa i madh eshte vektori, ndersa drejtimi dhe maja tregojne nga shkon.\n\n3. Shembull i vogel konceptual\nNese ecen 3 hapa djathtas, kjo mund te paraqitet si nje vektor me gjatesi 3 dhe drejtim djathtas. Nese ecen 3 hapa majtas, gjatesia eshte prape 3, por drejtimi ndryshon.\n\n4. Pyetje kontrolli\nNese nje shigjete eshte me e gjate se nje tjeter, cfare ndryshon te vektori?"
      },
      {
        terms: ["thyes", "thyesa", "thyese"],
        answer:
          "1. Idea kryesore\nThyesa tregon nje pjese te nje te tere.\n\n2. Shpjegim i thjeshte\nTe thyesa 1/2, numri lart tregon sa pjese kemi marre, ndersa numri poshte tregon ne sa pjese te barabarta eshte ndare e tera.\n\n3. Shembull i vogel konceptual\nNese nje pice ndahet ne 4 pjese te barabarta dhe ti merr 1 pjese, ke marre 1/4 e pices.\n\n4. Pyetje kontrolli\nTe thyesa 3/5, ne sa pjese te barabarta eshte ndare e tera?"
      },
      {
        terms: ["perqind", "percent", "%"],
        answer:
          "1. Idea kryesore\nPerqindja tregon sa pjese kemi nga 100 pjese.\n\n2. Shpjegim i thjeshte\n25% do te thote 25 nga 100. Kjo eshte e njejta ide si thyesa 25/100.\n\n3. Shembull i vogel konceptual\nNese 100 nxenes jane ne shkolle dhe 25 prej tyre jane ne biblioteke, atehere 25% e nxenesve jane ne biblioteke.\n\n4. Pyetje kontrolli\nCfare do te thote 50% me fjale te thjeshta?"
      },
      {
        terms: ["ekuacion", "barazim", "x"],
        answer:
          "1. Idea kryesore\nEkuacioni eshte nje barazim ku ka nje vlere te panjohur qe duhet kuptuar.\n\n2. Shpjegim i thjeshte\nShenja = tregon qe te dy anet duhet te kene te njejten vlere. Ne kerkojme vleren qe e ben barazimin te vertete.\n\n3. Shembull i vogel konceptual\nTe x + 2 = 5, pyetja eshte: cili numer kur i shtojme 2 jep 5?\n\n4. Pyetje kontrolli\nPse duhet te ruhet barazia kur ndryshojme te dy anet e ekuacionit?"
      },
      {
        terms: ["kend", "kendi", "angle"],
        answer:
          "1. Idea kryesore\nKendi tregon hapjen midis dy drejtezave ose dy rrezeve qe nisen nga e njejta pike.\n\n2. Shpjegim i thjeshte\nSa me shume hapen dy vijat, aq me i madh eshte kendi. Kendet maten me grade.\n\n3. Shembull i vogel konceptual\nKendi i drejte eshte 90 grade, si cepi i nje flete katrore.\n\n4. Pyetje kontrolli\nA eshte kendi 30 grade me i vogel apo me i madh se kendi 90 grade?"
      },
      {
        terms: ["derivat", "derivati", "derivatet"],
        answer:
          "1. Idea kryesore\nDerivati tregon sa shpejt ndryshon nje madhesi ne nje moment te caktuar.\n\n2. Shpjegim i thjeshte\nMendo nje grafik. Derivati tregon pjerrtesine e grafikut ne nje pike. Nese grafiku ngjitet shume shpejt, derivati eshte me i madh. Nese grafiku eshte pothuajse i sheshte, derivati eshte afer zeros.\n\n3. Shembull i vogel konceptual\nNese pozicioni i nje makine ndryshon me kohen, derivati i pozicionit tregon shpejtesine e makines ne ate moment.\n\n4. Pyetje kontrolli\nNese nje grafik eshte duke u rritur, mendon se derivati eshte pozitiv apo negativ?"
      },
      {
        terms: ["integral", "integrali", "integralet"],
        answer:
          "1. Idea kryesore\nIntegrali perdoret per te mbledhur shume ndryshime te vogla dhe shpesh lidhet me siperfaqen poshte nje grafiku.\n\n2. Shpjegim i thjeshte\nNese derivati tregon sa shpejt ndryshon dicka, integrali mund te ndihmoje te gjejme sa eshte grumbulluar gjithsej.\n\n3. Shembull i vogel konceptual\nNese nje grafik tregon shpejtesine e nje makine ne kohe, integrali i shpejtesise ndihmon te kuptojme sa rruge ka bere makina.\n\n4. Pyetje kontrolli\nMe cfare ideje lidhet me shume integrali: me ndryshimin ne nje moment apo me grumbullimin total?"
      },
      {
        terms: ["limit", "limiti", "limitet"],
        answer:
          "1. Idea kryesore\nLimiti tregon se ciles vlere i afrohet nje shprehje ose funksion kur ndryshorja afrohet te nje numer i caktuar.\n\n2. Shpjegim i thjeshte\nNuk pyesim gjithmone cfare ndodh fiks ne ate pike, por cfare vlere po afrohet nga afer.\n\n3. Shembull i vogel konceptual\nNese vlerat e nje funksioni afrohen gjithnje e me shume te 2, themi se limiti eshte 2.\n\n4. Pyetje kontrolli\nPse te limiti na intereson fjala \"afrohet\"?"
      },
      {
        terms: ["matrice", "matrica", "matricat", "matrix"],
        answer:
          "1. Idea kryesore\nMatrica eshte nje tabele me numra te vendosur ne rreshta dhe kolona.\n\n2. Shpjegim i thjeshte\nMatrica ndihmon te organizojme te dhena ose te kryejme veprime me shume numra ne menyre te rregullt.\n\n3. Shembull i vogel konceptual\nNje matrice 2 me 3 ka 2 rreshta dhe 3 kolona. Pra ka 6 vende per numra.\n\n4. Pyetje kontrolli\nNese nje matrice ka 3 rreshta dhe 2 kolona, sa elemente ka gjithsej?"
      },
      {
        terms: ["sinus", "cosinus", "kosinus", "tangent", "trigonometri"],
        answer:
          "1. Idea kryesore\nTrigonometria studion lidhjen midis kendeve dhe brinjeve te trekendeshave.\n\n2. Shpjegim i thjeshte\nSinusi, kosinusi dhe tangjenti jane menyra per te krahasuar brinjet e nje trekendeshi kenddrejte.\n\n3. Shembull i vogel konceptual\nNese nje trekendesh ka nje kend te njohur dhe nje brinje te njohur, trigonometria mund te ndihmoje te gjejme nje brinje tjeter.\n\n4. Pyetje kontrolli\nMe cfare figure gjeometrike lidhet zakonisht trigonometria ne fillim?"
      },
      {
        terms: ["logarit", "logaritmi", "logaritmet", "logarithm"],
        answer:
          "1. Idea kryesore\nLogaritmi tregon eksponentin qe duhet t'i japim nje baze per te marre nje numer.\n\n2. Shpjegim i thjeshte\nNese 10^2 = 100, atehere logaritmi me baze 10 i 100 eshte 2.\n\n3. Shembull i vogel konceptual\nlog10(1000) = 3 sepse 10^3 = 1000.\n\n4. Pyetje kontrolli\nNese 2^4 = 16, sa eshte logaritmi me baze 2 i 16?"
      },
      {
        terms: ["polinom", "polinomi", "polinomet"],
        answer:
          "1. Idea kryesore\nPolinomi eshte nje shprehje algjebrike me terma qe permbajne numra, ndryshore dhe fuqi natyrore.\n\n2. Shpjegim i thjeshte\nShembuj polinomesh jane x + 3, 2x^2 - 5x + 1, ose x^3 + x.\n\n3. Shembull i vogel konceptual\nTe 2x^2 - 5x + 1 kemi tre terma: 2x^2, -5x dhe 1.\n\n4. Pyetje kontrolli\nSa terma ka shprehja x^2 + 4x + 4?"
      },
      {
        terms: ["inekuacion", "pabarazi", "me i madh", "me i vogel"],
        answer:
          "1. Idea kryesore\nInekuacioni eshte si ekuacioni, por perdor shenja krahasimi si <, >, <= ose >=.\n\n2. Shpjegim i thjeshte\nNe vend qe te kerkojme nje vlere qe e ben barazimin te vertete, kerkojme vlera qe e bejne krahasimin te vertete.\n\n3. Shembull i vogel konceptual\nx > 3 do te thote qe x mund te jete cdo numer me i madh se 3.\n\n4. Pyetje kontrolli\nA eshte 5 nje zgjidhje e pabarazise x > 3?"
      }
    ];

    return concepts.find((concept) => concept.terms.some((term) => question.includes(term)))?.answer || null;
  }

  private answerGeneralMathQuestion(question: string) {
    const cleanQuestion = question.trim().replace(/\s+/g, " ");
    const topic = cleanQuestion.length > 80 ? `${cleanQuestion.slice(0, 77)}...` : cleanQuestion;

    return [
      "1. Idea kryesore",
      `Pyetja jote lidhet me kete ide matematike: "${topic}". Per ta kuptuar mire, fillojme duke gjetur konceptin kryesor, rregullin ose formulen qe perdoret.`,
      "",
      "2. Shpjegim i thjeshte",
      "Nda pyetjen ne tre pjese: cfare dihet, cfare kerkohet, dhe cila lidhje matematike i bashkon. Pastaj perdor perkufizimin ose formulen perkatese, jo vetem llogaritje mekanike.",
      "",
      "3. Shembull i vogel konceptual",
      "Nese pyetja eshte per nje koncept, kerko nje shembull te vogel me numra ose figure te thjeshte. Nese eshte per nje metode, provo te shkruash hapat: identifiko te dhenat, zgjidh rregullin, zbatoje me kujdes, kontrollo rezultatin.",
      "",
      "4. Pyetje kontrolli",
      "A do qe ta shpjegoj me nje shembull me te thjeshte, apo te tregoj hapat e pergjithshem pa e zgjidhur detyren komplet?"
    ].join("\n");
  }

  private isGreeting(question: string) {
    return /^(hi|hello|hey|pershendetje|tung|ckemi|c kemi|miremengjes|miredita|mirembrema)$/.test(question);
  }
}
