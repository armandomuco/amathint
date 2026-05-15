import { Controller, Get, Headers } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import { AnalyticsService } from "./analytics.service";

function tokenFromHeader(value: string | undefined) {
  if (!value) return undefined;
  const [scheme, token] = value.split(" ");
  return scheme?.toLowerCase() === "bearer" ? token : undefined;
}

@Controller("analytics")
export class AnalyticsController {
  constructor(
    private readonly auth: AuthService,
    private readonly analytics: AnalyticsService
  ) {}

  @Get("teacher-dashboard")
  async teacherDashboard(@Headers("authorization") authorization: string | undefined) {
    const user = await this.auth.currentUserFromToken(tokenFromHeader(authorization));
    return this.analytics.teacherDashboard(user);
  }

  @Get("student-dashboard")
  async studentDashboard(@Headers("authorization") authorization: string | undefined) {
    const user = await this.auth.currentUserFromToken(tokenFromHeader(authorization));
    return this.analytics.studentDashboard(user);
  }
}
