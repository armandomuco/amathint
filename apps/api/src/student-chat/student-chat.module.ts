import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { StudentChatAiService } from "./student-chat.ai";
import { StudentChatController, StudentChatbotController } from "./student-chat.controller";
import { StudentChatService } from "./student-chat.service";

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [StudentChatController, StudentChatbotController],
  providers: [StudentChatAiService, StudentChatService]
})
export class StudentChatModule {}
