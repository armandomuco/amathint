import { Body, Controller, Get, Headers, Param, Post } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import type { AskStudentChatBody } from "./student-chat.types";
import { StudentChatService } from "./student-chat.service";

function tokenFromHeader(value: string | undefined) {
  if (!value) {
    return undefined;
  }
  const [scheme, token] = value.split(" ");
  return scheme?.toLowerCase() === "bearer" ? token : undefined;
}

@Controller("student-chat")
export class StudentChatController {
  constructor(
    private readonly auth: AuthService,
    private readonly studentChat: StudentChatService
  ) {}

  @Post("messages")
  async ask(@Headers("authorization") authorization: string | undefined, @Body() body: AskStudentChatBody) {
    const user = await this.auth.currentUserFromToken(tokenFromHeader(authorization));
    return this.studentChat.ask(user, body);
  }

  @Get("conversations")
  async listConversations(@Headers("authorization") authorization: string | undefined) {
    const user = await this.auth.currentUserFromToken(tokenFromHeader(authorization));
    return this.studentChat.listConversations(user);
  }

  @Get("history")
  async history(@Headers("authorization") authorization: string | undefined) {
    const user = await this.auth.currentUserFromToken(tokenFromHeader(authorization));
    return this.studentChat.history(user);
  }

  @Get("conversations/:id")
  async getConversation(@Headers("authorization") authorization: string | undefined, @Param("id") id: string) {
    const user = await this.auth.currentUserFromToken(tokenFromHeader(authorization));
    return this.studentChat.getConversation(user, id);
  }
}

@Controller("chatbot/student")
export class StudentChatbotController {
  constructor(
    private readonly auth: AuthService,
    private readonly studentChat: StudentChatService
  ) {}

  @Post("messages")
  async ask(@Headers("authorization") authorization: string | undefined, @Body() body: AskStudentChatBody) {
    const user = await this.auth.currentUserFromToken(tokenFromHeader(authorization));
    return this.studentChat.ask(user, body);
  }

  @Get("conversations")
  async listConversations(@Headers("authorization") authorization: string | undefined) {
    const user = await this.auth.currentUserFromToken(tokenFromHeader(authorization));
    return this.studentChat.listConversations(user);
  }

  @Get("history")
  async history(@Headers("authorization") authorization: string | undefined) {
    const user = await this.auth.currentUserFromToken(tokenFromHeader(authorization));
    return this.studentChat.history(user);
  }

  @Get("conversations/:id")
  async getConversation(@Headers("authorization") authorization: string | undefined, @Param("id") id: string) {
    const user = await this.auth.currentUserFromToken(tokenFromHeader(authorization));
    return this.studentChat.getConversation(user, id);
  }
}
