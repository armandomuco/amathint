import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import type { AuthUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async teacherDashboard(user: AuthUser | null) {
    const teacher = this.requireTeacher(user);
    const messages = await this.prisma.chatMessage.findMany({
      where: {
        role: "student",
        conversation: {
          student: {
            schoolIdentifier: teacher.schoolIdentifier
          }
        }
      },
      include: {
        conversation: {
          include: {
            student: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    const totalQuestions = messages.length;
    const uniqueStudents = new Set(messages.map((message) => message.conversation.studentId)).size;
    const averageRisk = totalQuestions
      ? Math.round(messages.reduce((sum, message) => sum + (message.riskScore || 20), 0) / totalQuestions)
      : 0;

    const keywordMap = new Map<string, { keyword: string; count: number; averageRisk: number; totalRisk: number }>();
    for (const message of messages) {
      const keyword = message.mathKeyword || "Të përgjithshme";
      const current = keywordMap.get(keyword) || { keyword, count: 0, averageRisk: 0, totalRisk: 0 };
      current.count += 1;
      current.totalRisk += message.riskScore || 20;
      current.averageRisk = Math.round(current.totalRisk / current.count);
      keywordMap.set(keyword, current);
    }

    const topKeywords = [...keywordMap.values()]
      .sort((a, b) => b.count - a.count || b.averageRisk - a.averageRisk)
      .slice(0, 8)
      .map(({ totalRisk, ...row }) => row);

    const riskSummary = {
      low: messages.filter((message) => (message.riskLevel || "low") === "low").length,
      medium: messages.filter((message) => message.riskLevel === "medium").length,
      high: messages.filter((message) => message.riskLevel === "high").length
    };

    const recentQuestions = messages.slice(0, 8).map((message) => ({
      id: message.id,
      studentName: message.conversation.student.name,
      question: message.content,
      keyword: message.mathKeyword || "Të përgjithshme",
      riskLevel: message.riskLevel || "low",
      riskScore: message.riskScore || 20,
      createdAt: message.createdAt
    }));

    return {
      summary: {
        schoolIdentifier: teacher.schoolIdentifier,
        totalQuestions,
        uniqueStudents,
        averageRisk
      },
      topKeywords,
      riskSummary,
      recentQuestions
    };
  }

  async studentDashboard(user: AuthUser | null) {
    const student = this.requireStudent(user);
    const conversations = await this.prisma.chatConversation.findMany({
      where: { studentId: student.id },
      include: {
        messages: {
          orderBy: { createdAt: "asc" }
        }
      },
      orderBy: { updatedAt: "desc" }
    });

    const questionMessages = conversations.flatMap((conversation) =>
      conversation.messages
        .filter((message) => message.role === "student")
        .map((message) => ({
          ...message,
          conversationTitle: conversation.title
        }))
    );
    const assistantMessages = conversations.flatMap((conversation) =>
      conversation.messages.filter((message) => message.role === "assistant")
    );

    const keywordMap = new Map<string, number>();
    for (const message of questionMessages) {
      const keyword = message.mathKeyword || "Të përgjithshme";
      keywordMap.set(keyword, (keywordMap.get(keyword) || 0) + 1);
    }

    const recentQa = conversations
      .flatMap((conversation) => {
        const rows = [];
        for (let index = 0; index < conversation.messages.length; index += 1) {
          const message = conversation.messages[index];
          if (message.role !== "student") continue;
          const answer = conversation.messages.slice(index + 1).find((next) => next.role === "assistant");
          rows.push({
            id: message.id,
            conversationId: conversation.id,
            question: message.content,
            answer: answer?.content || "",
            keyword: message.mathKeyword || "Të përgjithshme",
            riskLevel: message.riskLevel || "low",
            createdAt: message.createdAt
          });
        }
        return rows;
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10);

    return {
      summary: {
        totalQuestions: questionMessages.length,
        totalAnswers: assistantMessages.length,
        totalConversations: conversations.length
      },
      topKeywords: [...keywordMap.entries()]
        .map(([keyword, count]) => ({ keyword, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6),
      recentQa
    };
  }

  private requireTeacher(user: AuthUser | null) {
    if (!user) throw new UnauthorizedException("Missing or invalid session.");
    if (user.role !== "teacher") throw new ForbiddenException("Only teachers can view teacher analytics.");
    return user;
  }

  private requireStudent(user: AuthUser | null) {
    if (!user) throw new UnauthorizedException("Missing or invalid session.");
    if (user.role !== "student") throw new ForbiddenException("Only students can view student analytics.");
    return user;
  }
}
