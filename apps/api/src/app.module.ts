import { Module } from "@nestjs/common";
import { AnalyticsModule } from "./analytics/analytics.module";
import { AppController } from "./app.controller";
import { AuthModule } from "./auth/auth.module";
import { PrismaModule } from "./prisma/prisma.module";
import { SchoolsModule } from "./schools/schools.module";
import { StudentChatModule } from "./student-chat/student-chat.module";
import { TeacherAssistantModule } from "./teacher-assistant/teacher-assistant.module";

@Module({
  imports: [PrismaModule, AuthModule, SchoolsModule, StudentChatModule, TeacherAssistantModule, AnalyticsModule],
  controllers: [AppController]
})
export class AppModule {}
