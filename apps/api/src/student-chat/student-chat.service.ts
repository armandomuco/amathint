import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import type { AuthUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { analyzeQuestion } from "./question-insights";
import { StudentChatAiService } from "./student-chat.ai";
import type { AskStudentChatBody } from "./student-chat.types";

const MAX_QUESTION_LENGTH = 800;

@Injectable()
export class StudentChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: StudentChatAiService
  ) {}

  async ask(user: AuthUser | null, body: AskStudentChatBody) {
    const student = this.requireStudent(user);
    const question = this.cleanQuestion(body.question);
    const conversation = await this.findOrCreateConversation(student.id, question, body.conversationId);
    const history = await this.getRecentHistory(conversation.id);
    const answer = await this.ai.answer(question, history);
    const insights = analyzeQuestion(question);

    const [studentMessage, assistantMessage] = await this.prisma.$transaction([
      this.prisma.chatMessage.create({
        data: {
          conversationId: conversation.id,
          role: "student",
          content: question,
          mathKeyword: insights.mathKeyword,
          riskLevel: insights.riskLevel,
          riskScore: insights.riskScore
        }
      }),
      this.prisma.chatMessage.create({
        data: {
          conversationId: conversation.id,
          role: "assistant",
          content: answer.content,
          provider: answer.provider,
          model: answer.model
        }
      })
    ]);

    return {
      conversation: {
        id: conversation.id,
        title: conversation.title
      },
      messages: [studentMessage, assistantMessage]
    };
  }

  async listConversations(user: AuthUser | null) {
    const student = this.requireStudent(user);
    const conversations = await this.prisma.chatConversation.findMany({
      where: { studentId: student.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return { conversations };
  }

  async getConversation(user: AuthUser | null, conversationId: string) {
    const student = this.requireStudent(user);
    const conversation = await this.prisma.chatConversation.findFirst({
      where: {
        id: conversationId,
        studentId: student.id
      },
      include: {
        messages: {
          orderBy: { createdAt: "asc" }
        }
      }
    });

    if (!conversation) {
      throw new NotFoundException("Conversation was not found.");
    }

    return { conversation };
  }

  private requireStudent(user: AuthUser | null) {
    if (!user) {
      throw new UnauthorizedException("Missing or invalid session.");
    }
    if (user.role !== "student") {
      throw new ForbiddenException("Only students can use this chat.");
    }
    return user;
  }

  private cleanQuestion(question: unknown) {
    const text = String(question || "").trim();
    if (text.length < 3 && !this.isGreeting(text)) {
      throw new BadRequestException("Question must have at least 3 characters.");
    }
    if (text.length > MAX_QUESTION_LENGTH) {
      throw new BadRequestException(`Question must be ${MAX_QUESTION_LENGTH} characters or less.`);
    }
    return text;
  }

  private isGreeting(question: string) {
    const normalized = question
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    return /^(hi|hello|hey|pershendetje|tung|ckemi|c kemi|miremengjes|miredita|mirembrema)$/.test(normalized);
  }

  private async findOrCreateConversation(studentId: string, question: string, conversationId: unknown) {
    const existingId = typeof conversationId === "string" ? conversationId.trim() : "";
    if (existingId) {
      const conversation = await this.prisma.chatConversation.findFirst({
        where: {
          id: existingId,
          studentId
        }
      });
      if (!conversation) {
        throw new NotFoundException("Conversation was not found.");
      }
      return conversation;
    }

    return this.prisma.chatConversation.create({
      data: {
        studentId,
        title: this.makeTitle(question)
      }
    });
  }

  private makeTitle(question: string) {
    return question.length > 48 ? `${question.slice(0, 45)}...` : question;
  }

  private async getRecentHistory(conversationId: string) {
    return this.prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      take: 10,
      select: {
        role: true,
        content: true
      }
    });
  }
}
