export type Role = "student" | "teacher";

export type User = {
  id: string;
  name: string;
  email: string;
  schoolIdentifier: string;
  schoolId: string;
  schoolName: string;
  schoolQark?: string | null;
  studentGrade?: number | null;
  teacherGrades: number[];
  role: Role;
};

export type School = {
  id: string;
  name: string;
  qark: string;
  city: string;
  level: "primary" | "high";
};

export type AuthResponse = {
  token: string;
  expiresAt: string;
  user: User;
};

export type TeacherDashboardData = {
  summary: {
    schoolIdentifier: string;
    schoolName?: string;
    schoolQark?: string | null;
    teacherGrades: number[];
    selectedGrade?: number | null;
    totalQuestions: number;
    uniqueStudents: number;
    averageRisk: number;
    mathQuestions: number;
    outOfMathQuestions: number;
    availableGrades: number[];
  };
  topKeywords: Array<{ keyword: string; count: number; averageRisk: number }>;
  riskSummary: { low: number; medium: number; high: number };
  riskExplanation: string;
  topicMethod: string;
  recentQuestions: Array<{
    id: string;
    studentName: string;
    question: string;
    keyword: string;
    riskLevel: string;
    riskScore: number;
    createdAt: string;
  }>;
};

export type StudentDashboardData = {
  summary: {
    totalQuestions: number;
    totalAnswers: number;
    totalConversations: number;
    mathQuestions: number;
    outOfMathQuestions: number;
  };
  topKeywords: Array<{ keyword: string; count: number }>;
  recentQa: Array<{
    id: string;
    conversationId: string;
    question: string;
    answer: string;
    keyword: string;
    riskLevel: string;
    createdAt: string;
  }>;
};

export type StudentHistoryItem = {
  id: string;
  conversationId: string;
  conversationTitle: string;
  question: string;
  answer: string;
  keyword: string;
  riskLevel: string;
  createdAt: string;
};

export type TeacherDocument = {
  id: string;
  lessonId?: string;
  summary?: string;
  createdAt: string;
  hasDocx: boolean;
  downloadToken: string;
  folder?: string;
};

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:4000";
const SERVER_UNAVAILABLE = "SERVER_UNAVAILABLE";

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...options.headers
      }
    });
  } catch {
    throw new Error(SERVER_UNAVAILABLE);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status >= 500 || response.status === 503) {
      throw new Error(SERVER_UNAVAILABLE);
    }
    throw new Error(data.message || data.error || "Request failed.");
  }
  return data as T;
}

export function signup(payload: {
  name: string;
  email: string;
  password: string;
  role: Role;
  schoolId: string;
  studentGrade?: number | null;
  teacherGrades?: number[];
}) {
  return request<AuthResponse>("/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function login(payload: { email: string; password: string }) {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateProfile(
  token: string,
  payload: {
    name: string;
    email: string;
    schoolId: string;
    studentGrade?: number | null;
    teacherGrades?: number[];
  }
) {
  return request<{ user: User }>(
    "/auth/profile",
    {
      method: "PATCH",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function getMe(token: string) {
  return request<{ user: User }>("/auth/me", {}, token);
}

export function listSchools() {
  return request<{ schools: School[] }>("/schools");
}

export function getTeacherDashboard(token: string, grade?: number | null) {
  const query = grade ? `?grade=${grade}` : "";
  return request<TeacherDashboardData>(`/analytics/teacher-dashboard${query}`, {}, token);
}

export function getStudentDashboard(token: string) {
  return request<StudentDashboardData>("/analytics/student-dashboard", {}, token);
}

export function askStudentChat(token: string, question: string, conversationId?: string) {
  return request<{
    conversation: { id: string; title: string };
    messages: Array<{ id: string; role: string; content: string; provider?: string; model?: string }>;
  }>(
    "/chatbot/student/messages",
    {
      method: "POST",
      body: JSON.stringify({ question, conversationId })
    },
    token
  );
}

export function listStudentHistory(token: string) {
  return request<{ history: StudentHistoryItem[] }>("/student-chat/history", {}, token);
}

export function createTeacherDitare(
  token: string,
  payload: { message: string; provider: "fake" | "anthropic"; force: boolean; render: boolean }
) {
  return request<{
    assistant: string;
    run: {
      id: string;
      status: string;
      lessonId?: string;
      jsonPath?: string;
      docxPath?: string;
      error?: string;
    };
    batch?: {
      subject: string;
      grade: number;
      total: number;
      generated: number;
      reused: number;
      failed: number;
    };
  }>(
    "/teacher-assistant/ditare",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function listTeacherDocuments(token: string) {
  return request<{ documents: TeacherDocument[] }>("/teacher-assistant/documents", {}, token);
}

export function deleteTeacherDocument(token: string, id: string) {
  return request<{ ok: boolean }>(
    `/teacher-assistant/documents/${id}`,
    {
      method: "DELETE"
    },
    token
  );
}

export function deleteTeacherDocumentFolder(token: string, folder: string) {
  return request<{ ok: boolean; deleted: number }>(
    `/teacher-assistant/documents/folders/${encodeURIComponent(folder)}`,
    {
      method: "DELETE"
    },
    token
  );
}

export function teacherDocumentDownloadUrl(id: string, downloadToken: string) {
  return `${API_BASE}/teacher-assistant/documents/${id}/download?token=${encodeURIComponent(downloadToken)}`;
}
