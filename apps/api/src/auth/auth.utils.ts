import crypto from "crypto";
import type { PublicRole } from "./auth.types";

const PASSWORD_ITERATIONS = 210000;

export function normalizeEmail(email: unknown) {
  return String(email || "").trim().toLowerCase();
}

export function toDbRole(role: PublicRole) {
  return role === "teacher" ? "TEACHER" : "STUDENT";
}

export function toPublicRole(role: string): PublicRole {
  return role === "TEACHER" ? "teacher" : "student";
}

export function parseRole(role: unknown): PublicRole | null {
  if (role === "teacher" || role === "student") {
    return role;
  }
  return null;
}

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, 32, "sha256").toString("hex");
  return `pbkdf2_sha256$${PASSWORD_ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [algorithm, iterationsText, salt, expected] = stored.split("$");
  if (algorithm !== "pbkdf2_sha256" || !iterationsText || !salt || !expected) {
    return false;
  }

  const iterations = Number(iterationsText);
  const actual = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256");
  const expectedBuffer = Buffer.from(expected, "hex");
  return actual.length === expectedBuffer.length && crypto.timingSafeEqual(actual, expectedBuffer);
}

export function createRawSessionToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
