import { Body, Controller, Get, Headers, Patch, Post } from "@nestjs/common";
import { AuthService } from "./auth.service";
import type { LoginBody, SignupBody, UpdateProfileBody } from "./auth.types";

function tokenFromHeader(value: string | undefined) {
  if (!value) {
    return undefined;
  }
  const [scheme, token] = value.split(" ");
  return scheme?.toLowerCase() === "bearer" ? token : undefined;
}

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("signup")
  signup(@Body() body: SignupBody) {
    return this.auth.signup(body);
  }

  @Post("login")
  login(@Body() body: LoginBody) {
    return this.auth.login(body);
  }

  @Get("me")
  me(@Headers("authorization") authorization: string | undefined) {
    return this.auth.me(tokenFromHeader(authorization));
  }

  @Patch("profile")
  updateProfile(@Headers("authorization") authorization: string | undefined, @Body() body: UpdateProfileBody) {
    return this.auth.updateProfile(tokenFromHeader(authorization), body);
  }

  @Post("logout")
  logout(@Headers("authorization") authorization: string | undefined) {
    return this.auth.logout(tokenFromHeader(authorization));
  }
}
