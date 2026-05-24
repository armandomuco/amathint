import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import type { AuthUser } from "../auth/auth.types";
import { createRawSessionToken, hashSessionToken } from "../auth/auth.utils";
import { PrismaService } from "../prisma/prisma.service";
import type { TeacherAssistantBody } from "./teacher-assistant.types";

const execFileAsync = promisify(execFile);
const ROOT_DIR = path.resolve(process.cwd(), "../..");
const CATALOG_PATH = path.join(ROOT_DIR, "data/catalog/curriculum_catalog.json");
const MAX_MESSAGE_LENGTH = 1000;
const DOWNLOAD_TOKEN_MINUTES = 15;

type CatalogTopic = {
  id: string;
  grade: number;
  tema: string;
  tematika?: string;
  subject?: string;
};

type ClassRequest = {
  grade: number;
  subject: "matematike";
};

@Injectable()
export class TeacherAssistantService {
  constructor(private readonly prisma: PrismaService) {}

  async createDitare(user: AuthUser | null, body: TeacherAssistantBody) {
    const teacher = this.requireTeacher(user);
    const message = this.cleanMessage(body.message);
    const topic = this.findRequestedTopic(message);
    const classRequest = topic ? null : this.findClassRequest(message);
    const provider = this.cleanProvider(body.provider);
    const force = body.force === true;
    const shouldRender = body.render !== false;

    if (this.isGreeting(message)) {
      const run = await this.prisma.teacherAssistantRun.create({
        data: {
          teacherId: teacher.id,
          requestText: message,
          provider,
          status: "greeting",
          summary: `Pershendetje! Si mund te te ndihmoj? Mund te kerkosh nje Ditare me lesson id, p.sh. MAT7_001, ose te kerkosh te gjitha Ditaret per Matematike per ${this.availableGradesText()}.`
        }
      });
      return {
        run,
        assistant: run.summary
      };
    }

    if (classRequest) {
      return this.createClassDitare(teacher, message, classRequest, provider, force, shouldRender);
    }

    if (!topic) {
      const unavailable = this.describeUnavailableRequest(message);
      const run = await this.prisma.teacherAssistantRun.create({
        data: {
          teacherId: teacher.id,
          requestText: message,
          provider,
          status: "needs_lesson",
          summary: unavailable || "Nuk gjeta temen e matematikes. Shkruaj lesson id, p.sh. MAT7_001, ose emrin e temes."
        }
      });
      return {
        run,
        assistant: run.summary
      };
    }

    const run = await this.prisma.teacherAssistantRun.create({
      data: {
        teacherId: teacher.id,
        requestText: message,
        lessonId: topic.id,
        provider,
        status: "running",
        summary: `Po pergatis Ditare per ${topic.id}: ${topic.tema}`
      }
    });

    try {
      const generateOutput = await this.runAmathint(["generate", "--lesson-id", topic.id, "--provider", provider, ...(force ? ["--force"] : [])]);
      const jsonPath = this.findArtifact("data/generated/lessons_json", topic.id, ".json");
      let docxPath: string | undefined;
      let renderOutput = "";

      if (shouldRender) {
        renderOutput = await this.runAmathint(["render", "--lesson-id", topic.id, ...(force ? ["--force"] : [])]);
        docxPath = this.findArtifact("outputs/amathint_docx", topic.id, ".docx");
      }

      const updated = await this.prisma.teacherAssistantRun.update({
        where: { id: run.id },
        data: {
          status: "completed",
          summary: `Ditare u pergatit per ${topic.id}: ${topic.tema}`,
          jsonPath,
          docxPath,
          error: null
        }
      });

      return {
        run: updated,
        topic,
        assistant: updated.summary,
        output: {
          generate: generateOutput,
          render: renderOutput || null
        }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Teacher assistant failed.";
      const failed = await this.prisma.teacherAssistantRun.update({
        where: { id: run.id },
        data: {
          status: "failed",
          summary: "Nuk munda ta perfundoj gjenerimin e Ditares.",
          error: message
        }
      });
      return {
        run: failed,
        topic,
        assistant: failed.summary,
        error: message
      };
    }
  }

  async listRuns(user: AuthUser | null) {
    const teacher = this.requireTeacher(user);
    const runs = await this.prisma.teacherAssistantRun.findMany({
      where: { teacherId: teacher.id },
      orderBy: { createdAt: "desc" },
      take: 30
    });
    return { runs };
  }

  async getRun(user: AuthUser | null, id: string) {
    const teacher = this.requireTeacher(user);
    const run = await this.prisma.teacherAssistantRun.findFirst({
      where: {
        id,
        teacherId: teacher.id
      }
    });

    if (!run) {
      throw new NotFoundException("Teacher assistant run was not found.");
    }

    return { run };
  }

  async listDocuments(user: AuthUser | null) {
    const teacher = this.requireTeacher(user);
    await this.deleteExpiredDownloadTokens();
    const runs = await this.prisma.teacherAssistantRun.findMany({
      where: {
        teacherId: teacher.id,
        status: "completed",
        docxPath: { not: null }
      },
      orderBy: { createdAt: "desc" },
      take: 300
    });
    const tokens = await Promise.all(runs.map((run) => this.createDownloadToken(teacher.id, run.id)));
    return {
      documents: runs.map((run, index) => ({
        id: run.id,
        lessonId: run.lessonId,
        summary: run.summary,
        createdAt: run.createdAt,
        hasDocx: Boolean(run.docxPath),
        downloadToken: tokens[index],
        folder: this.folderForLesson(run.lessonId)
      }))
    };
  }

  async getDownload(user: AuthUser | null, id: string) {
    const teacher = this.requireTeacher(user);
    const run = await this.prisma.teacherAssistantRun.findFirst({
      where: {
        id,
        teacherId: teacher.id
      }
    });
    if (!run) {
      throw new NotFoundException("Teacher document was not found.");
    }
    const filePath = run.docxPath;
    if (!filePath || !fs.existsSync(filePath)) {
      throw new NotFoundException("File was not found.");
    }
    return {
      path: filePath,
      filename: path.basename(filePath),
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    };
  }

  async getDownloadByToken(id: string, token: string | undefined) {
    if (!token) {
      throw new UnauthorizedException("Missing document download token.");
    }

    const downloadToken = await this.prisma.downloadToken.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      include: { run: true }
    });

    if (!downloadToken || downloadToken.expiresAt <= new Date() || downloadToken.runId !== id) {
      if (downloadToken) {
        await this.prisma.downloadToken.delete({ where: { id: downloadToken.id } }).catch(() => undefined);
      }
      throw new UnauthorizedException("Document download link is expired or invalid.");
    }

    const filePath = downloadToken.run.docxPath;
    if (!filePath || !fs.existsSync(filePath)) {
      throw new NotFoundException("File was not found.");
    }

    return {
      path: filePath,
      filename: path.basename(filePath),
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    };
  }

  async deleteDocument(user: AuthUser | null, id: string) {
    const teacher = this.requireTeacher(user);
    const run = await this.prisma.teacherAssistantRun.findFirst({
      where: {
        id,
        teacherId: teacher.id
      }
    });

    if (!run) {
      throw new NotFoundException("Teacher document was not found.");
    }

    const docxPath = run.docxPath;
    await this.prisma.teacherAssistantRun.delete({
      where: { id: run.id }
    });

    if (docxPath) {
      const otherRunUsingFile = await this.prisma.teacherAssistantRun.findFirst({
        where: {
          docxPath
        }
      });
      if (!otherRunUsingFile && fs.existsSync(docxPath)) {
        await fs.promises.unlink(docxPath).catch(() => undefined);
      }
    }

    return { ok: true };
  }

  async deleteDocumentFolder(user: AuthUser | null, folder: string) {
    const teacher = this.requireTeacher(user);
    const runs = await this.prisma.teacherAssistantRun.findMany({
      where: {
        teacherId: teacher.id,
        status: "completed",
        docxPath: { not: null }
      }
    });
    const folderRuns = runs.filter((run) => this.folderForLesson(run.lessonId) === folder);

    if (!folderRuns.length) {
      throw new NotFoundException("Teacher document folder was not found.");
    }

    const docxPaths = folderRuns.map((run) => run.docxPath).filter((value): value is string => Boolean(value));
    await this.prisma.teacherAssistantRun.deleteMany({
      where: {
        teacherId: teacher.id,
        id: { in: folderRuns.map((run) => run.id) }
      }
    });

    for (const docxPath of new Set(docxPaths)) {
      const otherRunUsingFile = await this.prisma.teacherAssistantRun.findFirst({
        where: {
          docxPath
        }
      });
      if (!otherRunUsingFile && fs.existsSync(docxPath)) {
        await fs.promises.unlink(docxPath).catch(() => undefined);
      }
    }

    return { ok: true, deleted: folderRuns.length };
  }

  private async createDownloadToken(teacherId: string, runId: string) {
    const token = createRawSessionToken();
    await this.prisma.downloadToken.create({
      data: {
        tokenHash: hashSessionToken(token),
        teacherId,
        runId,
        expiresAt: new Date(Date.now() + DOWNLOAD_TOKEN_MINUTES * 60 * 1000)
      }
    });
    return token;
  }

  private async deleteExpiredDownloadTokens() {
    await this.prisma.downloadToken.deleteMany({
      where: {
        expiresAt: { lte: new Date() }
      }
    });
  }

  private requireTeacher(user: AuthUser | null) {
    if (!user) {
      throw new UnauthorizedException("Missing or invalid session.");
    }
    if (user.role !== "teacher") {
      throw new ForbiddenException("Only teachers can use the teacher assistant.");
    }
    return user;
  }

  private cleanMessage(message: unknown) {
    const text = String(message || "").trim();
    if (text.length < 3 && !this.isGreeting(text)) {
      throw new BadRequestException("Message must have at least 3 characters.");
    }
    if (text.length > MAX_MESSAGE_LENGTH) {
      throw new BadRequestException(`Message must be ${MAX_MESSAGE_LENGTH} characters or less.`);
    }
    return text;
  }

  private isGreeting(message: string) {
    const normalized = this.normalize(message);
    return /^(hi|hello|hey|pershendetje|tung|ckemi|c kemi|miremengjes|miredita|mirembrema)$/.test(normalized);
  }

  private cleanProvider(provider: unknown) {
    const selected = String(provider || process.env.TEACHER_DITARE_PROVIDER || "fake").trim().toLowerCase();
    if (selected !== "fake" && selected !== "anthropic") {
      throw new BadRequestException("Provider must be fake or anthropic.");
    }
    return selected;
  }

  private async createClassDitare(
    teacher: AuthUser,
    message: string,
    request: ClassRequest,
    provider: "fake" | "anthropic",
    force: boolean,
    shouldRender: boolean
  ) {
    const topics = this.availableGeneratedTopics(request.subject, request.grade);
    if (!topics.length) {
      const run = await this.prisma.teacherAssistantRun.create({
        data: {
          teacherId: teacher.id,
          requestText: message,
          provider,
          status: "needs_lesson",
          summary: `Per momentin kemi dokumente te gatshme per Matematike per ${this.availableGradesText()}. Nuk kemi ende dokumente te gatshme per klasen ${request.grade}.`
        }
      });
      return { run, assistant: run.summary };
    }

    const folderName = this.folderName(request.subject, request.grade);
    const batchRun = await this.prisma.teacherAssistantRun.create({
      data: {
        teacherId: teacher.id,
        requestText: message,
        provider,
        status: "running",
        summary: `Po pergatis ${topics.length} Ditare per ${folderName}.`
      }
    });

    try {
      let generated = 0;
      let reused = 0;
      let failed = 0;

      for (const classTopic of topics) {
        const existing = await this.prisma.teacherAssistantRun.findFirst({
          where: {
            teacherId: teacher.id,
            lessonId: classTopic.id,
            status: "completed",
            docxPath: { not: null }
          }
        });

        if (existing && !force) {
          reused += 1;
          continue;
        }

        try {
          const generateOutput = await this.runAmathint([
            "generate",
            "--lesson-id",
            classTopic.id,
            "--provider",
            provider,
            ...(force ? ["--force"] : [])
          ]);
          let docxPath: string | undefined;
          let renderOutput = "";
          const jsonPath = this.findArtifact("data/generated/lessons_json", classTopic.id, ".json");

          if (shouldRender) {
            renderOutput = await this.runAmathint(["render", "--lesson-id", classTopic.id, ...(force ? ["--force"] : [])]);
            docxPath = this.findArtifact("outputs/amathint_docx", classTopic.id, ".docx");
          }

          await this.prisma.teacherAssistantRun.create({
            data: {
              teacherId: teacher.id,
              requestText: message,
              lessonId: classTopic.id,
              provider,
              status: "completed",
              summary: `Ditare u pergatit per ${classTopic.id}: ${classTopic.tema}`,
              jsonPath,
              docxPath,
              error: [generateOutput, renderOutput].filter(Boolean).join("\n") || null
            }
          });
          generated += 1;
        } catch (error) {
          failed += 1;
          await this.prisma.teacherAssistantRun.create({
            data: {
              teacherId: teacher.id,
              requestText: message,
              lessonId: classTopic.id,
              provider,
              status: "failed",
              summary: `Nuk u gjenerua Ditare per ${classTopic.id}.`,
              error: error instanceof Error ? error.message : "Generation failed."
            }
          });
        }
      }

      const summary = failed
        ? `${folderName}: u gjeneruan ${generated} dokumente, u perdoren ${reused} ekzistuese, ${failed} deshtuan. Dokumentet e perfunduara jane te ruajtura te Dokumentet.`
        : `${folderName}: u pergatiten ${generated} dokumente dhe u perdoren ${reused} ekzistuese. I gjen te ndara ne folder te Dokumentet.`;
      const updated = await this.prisma.teacherAssistantRun.update({
        where: { id: batchRun.id },
        data: {
          status: failed ? "completed_with_warnings" : "completed",
          summary,
          error: failed ? `${failed} lesson documents failed in the batch.` : null
        }
      });
      return {
        run: updated,
        assistant: summary,
        batch: {
          subject: request.subject,
          grade: request.grade,
          total: topics.length,
          generated,
          reused,
          failed
        }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Batch generation failed.";
      const failedRun = await this.prisma.teacherAssistantRun.update({
        where: { id: batchRun.id },
        data: {
          status: "failed",
          summary: "Nuk munda ta perfundoj gjenerimin e Ditarëve për klasën.",
          error: message
        }
      });
      return { run: failedRun, assistant: failedRun.summary, error: message };
    }
  }

  private findRequestedTopic(message: string): CatalogTopic | null {
    const topics = this.loadMathTopics();
    const lessonId = message.toUpperCase().match(/\bMAT\d+_\d{3}\b/)?.[0];
    if (lessonId) {
      return topics.find((topic) => topic.id === lessonId) || null;
    }

    const normalizedMessage = this.normalize(message);
    return (
      topics.find((topic) => normalizedMessage.includes(this.normalize(topic.tema))) ||
      topics.find((topic) => this.normalize(topic.tema).includes(normalizedMessage)) ||
      null
    );
  }

  private loadMathTopics(): CatalogTopic[] {
    const payload = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8")) as { topics?: CatalogTopic[] };
    return (payload.topics || []).filter((topic) => topic.subject === "matematike");
  }

  private availableGeneratedTopics(subject: "matematike", grade: number) {
    const generatedIds = new Set<string>();
    const folder = path.join(ROOT_DIR, "data/generated/lessons_json", subject, `Klasa_${grade}`);
    if (!fs.existsSync(folder)) {
      return [];
    }
    for (const entry of fs.readdirSync(folder)) {
      const id = entry.match(/^([A-Z]+\d+_\d{3})_/)?.[1];
      if (id) {
        generatedIds.add(id);
      }
    }
    return this.loadMathTopics()
      .filter((topic) => topic.grade === grade && generatedIds.has(topic.id))
      .sort((first, second) => first.id.localeCompare(second.id));
  }

  private availableGeneratedGrades() {
    const baseFolder = path.join(ROOT_DIR, "data/generated/lessons_json/matematike");
    if (!fs.existsSync(baseFolder)) {
      return [];
    }
    return fs
      .readdirSync(baseFolder, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => Number(entry.name.match(/^Klasa_(\d+)$/)?.[1]))
      .filter((grade) => Number.isInteger(grade))
      .sort((first, second) => first - second);
  }

  private availableGradesText() {
    const grades = this.availableGeneratedGrades();
    if (!grades.length) {
      return "asnje klase";
    }
    if (grades.length === 1) {
      return `klasa ${grades[0]}`;
    }
    return `klasat ${grades.slice(0, -1).join(", ")} dhe ${grades[grades.length - 1]}`;
  }

  private findClassRequest(message: string): ClassRequest | null {
    const normalizedMessage = this.normalize(message);
    if (this.includesUnsupportedSubject(normalizedMessage)) {
      return null;
    }
    if (!this.includesMathSubject(normalizedMessage)) {
      return null;
    }
    if (!/(ditare|gjener|generate|dokument|mesim|lesson)/.test(normalizedMessage)) {
      return null;
    }
    const grade = this.extractGrade(normalizedMessage);
    return grade ? { subject: "matematike", grade } : null;
  }

  private describeUnavailableRequest(message: string) {
    const normalizedMessage = this.normalize(message);
    if (this.includesUnsupportedSubject(normalizedMessage)) {
      return "Per momentin AmathInt eshte i kufizuar vetem per Matematike. Nuk kemi ende te dhena per TIK, Fizike ose lende te tjera.";
    }
    const grade = this.extractGrade(normalizedMessage);
    if (grade && this.includesMathSubject(normalizedMessage)) {
      return `Per momentin kemi dokumente te gjeneruara per Matematike per ${this.availableGradesText()}. Nuk kemi ende dokumente te gatshme per Matematike klasa ${grade}.`;
    }
    return null;
  }

  private includesMathSubject(normalizedMessage: string) {
    return /\b(mat|math|matematike|matematiken|matematika|matematikes)\b/.test(normalizedMessage);
  }

  private includesUnsupportedSubject(normalizedMessage: string) {
    return /\b(fizik|fizike|fizika|fiziken|fizikes|tik|tikun|informatike|informatika|kimi|kimia|biologji|biologjia|gjuhe|anglisht|histori|historia|gjeografi|gjeografia)\b/.test(
      normalizedMessage
    );
  }

  private extractGrade(normalizedMessage: string) {
    const match =
      normalizedMessage.match(/\b(?:klasa|klase|class|grade)\s*(?:e\s*)?(\d{1,2})\b/) ||
      normalizedMessage.match(/\b(\d{1,2})(?:te|t)?\s*(?:klasa|klase|class|grade)\b/);
    if (!match) {
      return null;
    }
    const grade = Number(match[1]);
    return Number.isInteger(grade) && grade >= 1 && grade <= 12 ? grade : null;
  }

  private folderForLesson(lessonId: string | null) {
    if (!lessonId) {
      return this.folderName("matematike", 0);
    }
    const match = lessonId.match(/^MAT(\d+)_/);
    return this.folderName("matematike", match ? Number(match[1]) : 0);
  }

  private folderName(subject: "matematike", grade: number) {
    if (subject === "matematike" && grade) {
      return `Matematika klasa ${grade}`;
    }
    return "Dokumente të tjera";
  }

  private normalize(value: string) {
    return value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  private async runAmathint(args: string[]) {
    const { stdout, stderr } = await execFileAsync(path.join(ROOT_DIR, "amathint"), args, {
      cwd: ROOT_DIR,
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8"
      },
      maxBuffer: 1024 * 1024 * 8
    });
    return [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");
  }

  private findArtifact(folder: string, lessonId: string, extension: string) {
    const base = path.join(ROOT_DIR, folder);
    if (!fs.existsSync(base)) {
      return undefined;
    }
    const stack = [base];
    while (stack.length) {
      const current = stack.pop();
      if (!current) {
        continue;
      }
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const entryPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(entryPath);
        } else if (entry.name.startsWith(`${lessonId}_`) && entry.name.endsWith(extension)) {
          return entryPath;
        }
      }
    }
    return undefined;
  }
}
