export type PublicRole = "teacher" | "student";

export type SignupBody = {
  name?: unknown;
  email?: unknown;
  password?: unknown;
  schoolIdentifier?: unknown;
  role?: unknown;
};

export type LoginBody = {
  email?: unknown;
  password?: unknown;
};

export type UpdateProfileBody = {
  name?: unknown;
  email?: unknown;
  schoolIdentifier?: unknown;
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  schoolIdentifier: string;
  role: PublicRole;
};
