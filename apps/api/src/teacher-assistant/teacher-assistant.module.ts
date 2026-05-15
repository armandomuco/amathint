import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { TeacherAssistantController } from "./teacher-assistant.controller";
import { TeacherAssistantService } from "./teacher-assistant.service";

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [TeacherAssistantController],
  providers: [TeacherAssistantService]
})
export class TeacherAssistantModule {}
