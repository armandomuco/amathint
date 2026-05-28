export type PublicRole = "teacher" | "student";

export type SignupBody = {
  name?: unknown;
  email?: unknown;
  password?: unknown;
  schoolIdentifier?: unknown;
  schoolId?: unknown;
  studentGrade?: unknown;
  teacherGrades?: unknown;
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
  schoolId?: unknown;
  studentGrade?: unknown;
  teacherGrades?: unknown;
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  schoolIdentifier: string;
  schoolId: string;
  schoolName: string;
  schoolQark?: string | null;
  studentGrade?: number | null;
  teacherGrades: number[];
  role: PublicRole;
};
