export type View =
  | "landing"
  | "signin"
  | "signup"
  | "dashboard"
  | "profile"
  | "student-chat"
  | "student-history"
  | "teacher-assistant"
  | "teacher-documents";

export type ChatMessage = {
  role: string;
  content: string;
  provider?: string;
  model?: string;
};
