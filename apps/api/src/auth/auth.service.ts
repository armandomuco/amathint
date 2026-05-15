import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthUser, LoginBody, SignupBody, UpdateProfileBody } from "./auth.types";
import {
  createRawSessionToken,
  hashPassword,
  hashSessionToken,
  normalizeEmail,
  parseRole,
  toDbRole,
  toPublicRole,
  verifyPassword
} from "./auth.utils";

const SESSION_DAYS = 7;

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async signup(body: SignupBody) {
    const name = String(body.name || "").trim();
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    const schoolIdentifier = String(body.schoolIdentifier || "").trim();
    const role = parseRole(body.role);

    if (name.length < 2) {
      throw new BadRequestException("Name must have at least 2 characters.");
    }
    if (!email.includes("@")) {
      throw new BadRequestException("Email is invalid.");
    }
    if (password.length < 6) {
      throw new BadRequestException("Password must have at least 6 characters.");
    }
    if (schoolIdentifier.length < 2) {
      throw new BadRequestException("School name must have at least 2 characters.");
    }
    if (!role) {
      throw new BadRequestException("Role must be teacher or student.");
    }

    try {
      const user = await this.prisma.user.create({
        data: {
          name,
          email,
          schoolIdentifier,
          role: toDbRole(role),
          passwordHash: hashPassword(password)
        }
      });
      return this.createAuthResponse(this.toAuthUser(user));
    } catch {
      throw new ConflictException("Email already exists.");
    }
  }

  async login(body: LoginBody) {
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException("Email or password is incorrect.");
    }

    return this.createAuthResponse(this.toAuthUser(user));
  }

  async me(token: string | undefined) {
    const user = await this.currentUserFromToken(token);
    if (!user) {
      throw new UnauthorizedException("Missing or invalid session.");
    }
    return { user };
  }

  async updateProfile(token: string | undefined, body: UpdateProfileBody) {
    const currentUser = await this.currentUserFromToken(token);
    if (!currentUser) {
      throw new UnauthorizedException("Missing or invalid session.");
    }

    const name = String(body.name || "").trim();
    const email = normalizeEmail(body.email);
    const schoolIdentifier = String(body.schoolIdentifier || "").trim();

    if (name.length < 2) {
      throw new BadRequestException("Name must have at least 2 characters.");
    }
    if (!email.includes("@")) {
      throw new BadRequestException("Email is invalid.");
    }
    if (schoolIdentifier.length < 2) {
      throw new BadRequestException("School name must have at least 2 characters.");
    }

    try {
      const user = await this.prisma.user.update({
        where: { id: currentUser.id },
        data: {
          name,
          email,
          schoolIdentifier
        }
      });
      return { user: this.toAuthUser(user) };
    } catch {
      throw new ConflictException("Email already exists.");
    }
  }

  async currentUserFromToken(token: string | undefined): Promise<AuthUser | null> {
    return this.userFromToken(token);
  }

  async logout(token: string | undefined) {
    if (token) {
      await this.prisma.session.deleteMany({
        where: { tokenHash: hashSessionToken(token) }
      });
    }
    return { ok: true };
  }

  private async createAuthResponse(user: AuthUser) {
    const token = createRawSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

    await this.prisma.session.create({
      data: {
        tokenHash: hashSessionToken(token),
        userId: user.id,
        expiresAt
      }
    });

    return {
      token,
      expiresAt,
      user
    };
  }

  private async userFromToken(token: string | undefined): Promise<AuthUser | null> {
    if (!token) {
      return null;
    }

    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      include: { user: true }
    });

    if (!session || session.expiresAt <= new Date()) {
      if (session) {
        await this.prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
      }
      return null;
    }

    return this.toAuthUser(session.user);
  }

  private toAuthUser(user: { id: string; name: string; email: string; schoolIdentifier: string; role: string }): AuthUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      schoolIdentifier: user.schoolIdentifier,
      role: toPublicRole(user.role)
    };
  }
}
