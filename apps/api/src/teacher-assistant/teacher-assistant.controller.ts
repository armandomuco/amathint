import { Body, Controller, Delete, Get, Headers, Param, Post, Query, Res } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import { TeacherAssistantService } from "./teacher-assistant.service";
import type { TeacherAssistantBody } from "./teacher-assistant.types";

function tokenFromHeader(value: string | undefined) {
  if (!value) {
    return undefined;
  }
  const [scheme, token] = value.split(" ");
  return scheme?.toLowerCase() === "bearer" ? token : undefined;
}

@Controller("teacher-assistant")
export class TeacherAssistantController {
  constructor(
    private readonly auth: AuthService,
    private readonly teacherAssistant: TeacherAssistantService
  ) {}

  @Post("ditare")
  async createDitare(@Headers("authorization") authorization: string | undefined, @Body() body: TeacherAssistantBody) {
    const user = await this.auth.currentUserFromToken(tokenFromHeader(authorization));
    return this.teacherAssistant.createDitare(user, body);
  }

  @Get("runs")
  async listRuns(@Headers("authorization") authorization: string | undefined) {
    const user = await this.auth.currentUserFromToken(tokenFromHeader(authorization));
    return this.teacherAssistant.listRuns(user);
  }

  @Get("runs/:id")
  async getRun(@Headers("authorization") authorization: string | undefined, @Param("id") id: string) {
    const user = await this.auth.currentUserFromToken(tokenFromHeader(authorization));
    return this.teacherAssistant.getRun(user, id);
  }

  @Get("documents")
  async listDocuments(@Headers("authorization") authorization: string | undefined) {
    const user = await this.auth.currentUserFromToken(tokenFromHeader(authorization));
    return this.teacherAssistant.listDocuments(user);
  }

  @Get("documents/:id/download")
  async downloadDocument(
    @Headers("authorization") authorization: string | undefined,
    @Param("id") id: string,
    @Query("token") token: string | undefined,
    @Res() response: { setHeader(name: string, value: string): void; download(path: string, filename: string): void }
  ) {
    const headerToken = tokenFromHeader(authorization);
    const file = headerToken
      ? await this.teacherAssistant.getDownload(await this.auth.currentUserFromToken(headerToken), id)
      : await this.teacherAssistant.getDownloadByToken(id, token);
    response.setHeader("content-type", file.contentType);
    return response.download(file.path, file.filename);
  }

  @Delete("documents/folders/:folder")
  async deleteDocumentFolder(@Headers("authorization") authorization: string | undefined, @Param("folder") folder: string) {
    const user = await this.auth.currentUserFromToken(tokenFromHeader(authorization));
    return this.teacherAssistant.deleteDocumentFolder(user, decodeURIComponent(folder));
  }

  @Delete("documents/:id")
  async deleteDocument(@Headers("authorization") authorization: string | undefined, @Param("id") id: string) {
    const user = await this.auth.currentUserFromToken(tokenFromHeader(authorization));
    return this.teacherAssistant.deleteDocument(user, id);
  }
}
