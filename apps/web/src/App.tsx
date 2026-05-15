import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  askStudentChat,
  AuthResponse,
  createTeacherDitare,
  deleteTeacherDocument,
  getMe,
  getStudentDashboard,
  getTeacherDashboard,
  listTeacherDocuments,
  login,
  Role,
  signup,
  StudentDashboardData,
  TeacherDashboardData,
  TeacherDocument,
  teacherDocumentDownloadUrl,
  updateProfile
} from "./api";
import { Language, languageNames, translations } from "./i18n";

type View =
  | "landing"
  | "signin"
  | "signup"
  | "dashboard"
  | "profile"
  | "student-chat"
  | "teacher-assistant"
  | "teacher-documents";
type ChatMessage = { role: string; content: string; provider?: string; model?: string };

const savedAuth = localStorage.getItem("amathint_auth");
const savedLanguage = localStorage.getItem("amathint_language") as Language | null;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(value: string) {
  return emailPattern.test(value.trim());
}

function App() {
  const [auth, setAuth] = useState<AuthResponse | null>(() => (savedAuth ? JSON.parse(savedAuth) : null));
  const [view, setView] = useState<View>(auth ? "dashboard" : "landing");
  const [language, setLanguageState] = useState<Language>(savedLanguage === "en" ? "en" : "sq");
  const copy = translations[language];

  useEffect(() => {
    let cancelled = false;
    async function verifySavedSession() {
      if (!auth?.token) return;
      try {
        const response = await getMe(auth.token);
        if (!cancelled) {
          updateSavedAuth({ ...auth, user: response.user });
        }
      } catch {
        if (!cancelled) {
          localStorage.removeItem("amathint_auth");
          setAuth(null);
          setView("landing");
        }
      }
    }
    verifySavedSession();
    return () => {
      cancelled = true;
    };
  }, [auth?.token]);

  function setLanguage(nextLanguage: Language) {
    localStorage.setItem("amathint_language", nextLanguage);
    setLanguageState(nextLanguage);
  }

  function saveAuth(nextAuth: AuthResponse) {
    localStorage.setItem("amathint_auth", JSON.stringify(nextAuth));
    setAuth(nextAuth);
    setView("dashboard");
  }

  function updateSavedAuth(nextAuth: AuthResponse) {
    localStorage.setItem("amathint_auth", JSON.stringify(nextAuth));
    setAuth(nextAuth);
  }

  function logout() {
    localStorage.removeItem("amathint_auth");
    setAuth(null);
    setView("landing");
  }

  return (
    <div className="app-shell">
      <Header
        auth={auth}
        copy={copy}
        language={language}
        setLanguage={setLanguage}
        setView={setView}
        view={view}
        logout={logout}
      />
      {view === "landing" && <Landing copy={copy} setView={setView} />}
      {view === "signin" && <AuthPage copy={copy} mode="signin" saveAuth={saveAuth} setView={setView} />}
      {view === "signup" && <AuthPage copy={copy} mode="signup" saveAuth={saveAuth} setView={setView} />}
      {view === "dashboard" && auth && <Dashboard auth={auth} copy={copy} setView={setView} />}
      {view === "profile" && auth && <ProfilePage auth={auth} copy={copy} updateSavedAuth={updateSavedAuth} />}
      {view === "student-chat" && auth && <StudentChat copy={copy} token={auth.token} />}
      {view === "teacher-assistant" && auth && <TeacherAssistant copy={copy} token={auth.token} />}
      {view === "teacher-documents" && auth && auth.user.role === "teacher" && (
        <TeacherDocuments copy={copy} token={auth.token} />
      )}
    </div>
  );
}

function Header({
  auth,
  copy,
  language,
  setLanguage,
  setView,
  view,
  logout
}: {
  auth: AuthResponse | null;
  copy: typeof translations.en;
  language: Language;
  setLanguage: (language: Language) => void;
  setView: (view: View) => void;
  view: View;
  logout: () => void;
}) {
  const chatView = auth?.user.role === "student" ? "student-chat" : "teacher-assistant";
  return (
    <header className="topbar">
      <button className="brand" onClick={() => setView(auth ? "dashboard" : "landing")}>
        <img className="brand-logo" src="/amathint-logo.svg" alt="" />
        <Wordmark />
      </button>
      <nav>
        <div className="language-switch" aria-label="Language">
          {(["sq", "en"] as Language[]).map((item) => (
            <button
              key={item}
              className={language === item ? "active" : ""}
              onClick={() => setLanguage(item)}
              type="button"
            >
              {languageNames[item]}
            </button>
          ))}
        </div>
        {auth ? (
          <>
            <button className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}>
              {copy.navDashboard}
            </button>
            <button className={view === "profile" ? "active" : ""} onClick={() => setView("profile")}>
              {copy.navProfile}
            </button>
            <button className={view === chatView ? "active" : ""} onClick={() => setView(chatView)}>
              {copy.navChat}
            </button>
            {auth.user.role === "teacher" && (
              <button
                className={view === "teacher-documents" ? "active" : ""}
                onClick={() => setView("teacher-documents")}
              >
                {copy.navDocuments}
              </button>
            )}
            <button className="outline" onClick={logout}>
              {copy.navSignOut}
            </button>
          </>
        ) : (
          <>
            <button className="auth-nav-button" onClick={() => setView("signin")}>{copy.navSignIn}</button>
            <button className="auth-nav-button" onClick={() => setView("signup")}>
              {copy.navSignUp}
            </button>
          </>
        )}
      </nav>
    </header>
  );
}

function Landing({ copy, setView }: { copy: typeof translations.en; setView: (view: View) => void }) {
  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">{copy.heroEyebrow}</p>
          <h1>
            <Wordmark />
          </h1>
          <p>{copy.heroBody}</p>
          <div className="actions">
            <button className="primary" onClick={() => setView("signup")}>
              {copy.createAccount}
            </button>
            <button className="outline" onClick={() => setView("signin")}>
              {copy.signIn}
            </button>
          </div>
        </div>
        <div className="lesson-visual">
          <img className="hero-logo" src="/amathint-logo.svg" alt="Amathint logo" />
          <div className="notebook">
            <div className="notebook-row strong">MAT7_001</div>
            <div className="notebook-row">{copy.notebookTopic}</div>
            <div className="notebook-grid">
              <span>1/2</span>
              <span>25%</span>
              <span>x + 4 = 9</span>
              <span>90°</span>
            </div>
          </div>
        </div>
      </section>
      <section className="feature-band">
        <article>
          <h2>{copy.students}</h2>
          <p>{copy.studentsBody}</p>
        </article>
        <article>
          <h2>{copy.teachers}</h2>
          <p>{copy.teachersBody}</p>
        </article>
        <article>
          <h2>{copy.schools}</h2>
          <p>{copy.schoolsBody}</p>
        </article>
      </section>
    </main>
  );
}

function Wordmark() {
  return (
    <span className="wordmark" aria-label="AmathInt">
      <span className="wordmark-accent">A</span>
      <span className="wordmark-core">math</span>
      <span className="wordmark-accent">Int</span>
    </span>
  );
}

function AuthPage({
  copy,
  mode,
  saveAuth,
  setView
}: {
  copy: typeof translations.en;
  mode: "signin" | "signup";
  saveAuth: (auth: AuthResponse) => void;
  setView: (view: View) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [schoolIdentifier, setSchoolIdentifier] = useState("");
  const [role, setRole] = useState<Role>("student");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");

    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const cleanSchool = schoolIdentifier.trim();
    const cleanPassword = password.trim();
    if (
      !isValidEmail(cleanEmail) ||
      cleanPassword.length < 6 ||
      (mode === "signup" && (cleanName.length < 2 || cleanSchool.length < 2))
    ) {
      setError(mode === "signup" ? copy.signupValidation : copy.authValidation);
      return;
    }

    setLoading(true);
    try {
      const response =
        mode === "signup"
          ? await signup({ name: cleanName, email: cleanEmail, password: cleanPassword, role, schoolIdentifier: cleanSchool })
          : await login({ email: cleanEmail, password: cleanPassword });
      saveAuth(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.authFailed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-layout">
      <img className="auth-bg-logo" src="/amathint-logo.svg" alt="" />
      <section className="auth-panel">
        <p className="eyebrow">{mode === "signup" ? copy.createAccess : copy.welcomeBack}</p>
        <h1>{mode === "signup" ? copy.signUp : copy.signIn}</h1>
        <form onSubmit={submit} noValidate>
          {mode === "signup" && (
            <>
              <label>
                {copy.fullName}
                <input value={name} onChange={(event) => setName(event.target.value)} />
              </label>
              <label>
                {copy.schoolIdentifier}
                <input
                  value={schoolIdentifier}
                  onChange={(event) => setSchoolIdentifier(event.target.value)}
                  placeholder={copy.schoolPlaceholder}
                />
              </label>
              <div className="segmented">
                <button type="button" className={role === "student" ? "active" : ""} onClick={() => setRole("student")}>
                  {copy.student}
                </button>
                <button type="button" className={role === "teacher" ? "active" : ""} onClick={() => setRole("teacher")}>
                  {copy.teacher}
                </button>
              </div>
            </>
          )}
          <label>
            {copy.email}
            <input inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            {copy.password}
            <span className="password-field">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                aria-label={showPassword ? copy.hidePassword : copy.showPassword}
                className="password-toggle"
                onClick={() => setShowPassword((visible) => !visible)}
                type="button"
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </span>
          </label>
          {error && <Alert tone="error" message={error} />}
          <button className="primary full" disabled={loading}>
            {loading ? copy.working : mode === "signup" ? copy.createAccount : copy.signIn}
          </button>
        </form>
        <button className="link-button" onClick={() => setView(mode === "signup" ? "signin" : "signup")}>
          {mode === "signup" ? copy.alreadyAccount : copy.needAccount}
        </button>
      </section>
    </main>
  );
}

function ProfilePage({
  auth,
  copy,
  updateSavedAuth
}: {
  auth: AuthResponse;
  copy: typeof translations.en;
  updateSavedAuth: (auth: AuthResponse) => void;
}) {
  const [name, setName] = useState(auth.user.name);
  const [email, setEmail] = useState(auth.user.email);
  const [schoolIdentifier, setSchoolIdentifier] = useState(auth.user.schoolIdentifier);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setStatus("");
    setError("");

    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const cleanSchool = schoolIdentifier.trim();
    if (cleanName.length < 2 || cleanSchool.length < 2 || !isValidEmail(cleanEmail)) {
      setError(copy.profileValidation);
      return;
    }

    setLoading(true);
    try {
      const response = await updateProfile(auth.token, {
        name: cleanName,
        email: cleanEmail,
        schoolIdentifier: cleanSchool
      });
      updateSavedAuth({
        ...auth,
        user: response.user
      });
      setStatus(copy.profileSaved);
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.profileFailed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="workspace">
      <section className="page-heading">
        <p className="eyebrow">{copy.accountData}</p>
        <h1>{copy.profileTitle}</h1>
        <p>{copy.profileSubtitle}</p>
      </section>
      <section className="profile-layout">
        <form className="profile-form" onSubmit={submit} noValidate>
          <label>
            {copy.fullName}
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            {copy.email}
            <input inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            {copy.schoolIdentifier}
            <input value={schoolIdentifier} onChange={(event) => setSchoolIdentifier(event.target.value)} />
          </label>
          <label>
            {copy.role}
            <input value={auth.user.role === "student" ? copy.student : copy.teacher} disabled />
          </label>
          {status && <Alert tone="success" message={status} />}
          {error && <Alert tone="error" message={error} />}
          <button className="primary full" disabled={loading}>
            {loading ? copy.working : copy.saveChanges}
          </button>
        </form>
        <aside className="profile-card">
          <div className="profile-icon">{auth.user.role === "student" ? "Σ" : "∫"}</div>
          <h2>{copy.profileCardTitle}</h2>
          <p>{copy.profileCardBody}</p>
          <dl>
            <div>
              <dt>{copy.role}</dt>
              <dd>{auth.user.role === "student" ? copy.student : copy.teacher}</dd>
            </div>
            <div>
              <dt>{copy.schoolIdentifier}</dt>
              <dd>{auth.user.schoolIdentifier}</dd>
            </div>
          </dl>
        </aside>
      </section>
    </main>
  );
}

function Dashboard({ auth, copy, setView }: { auth: AuthResponse; copy: typeof translations.en; setView: (view: View) => void }) {
  const action = auth.user.role === "student" ? "student-chat" : "teacher-assistant";
  const [teacherData, setTeacherData] = useState<TeacherDashboardData | null>(null);
  const [studentData, setStudentData] = useState<StudentDashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadDashboard() {
      setError("");
      try {
        if (auth.user.role === "teacher") {
          const data = await getTeacherDashboard(auth.token);
          if (!cancelled) setTeacherData(data);
        } else {
          const data = await getStudentDashboard(auth.token);
          if (!cancelled) setStudentData(data);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Dashboard request failed.");
      }
    }
    loadDashboard();
    return () => {
      cancelled = true;
    };
  }, [auth.token, auth.user.role]);

  return (
    <main className="workspace">
      <section className="page-heading">
        <p className="eyebrow">{auth.user.schoolIdentifier}</p>
        <h1>{auth.user.role === "student" ? copy.studentDashboard : copy.teacherDashboard}</h1>
        <p>
          {copy.welcome}, {auth.user.name}. {copy.dashboardNext}
        </p>
      </section>
      {error && <Alert tone="error" message={error} />}
      <section className="dashboard-grid">
        <button className="task-tile" onClick={() => setView(action)}>
          <span>{auth.user.role === "student" ? copy.studentChatTile : copy.teacherAssistantTile}</span>
          <small>{auth.user.role === "student" ? copy.askConcepts : copy.generateReports}</small>
        </button>
        {auth.user.role === "teacher" && teacherData && <TeacherAnalytics copy={copy} data={teacherData} />}
        {auth.user.role === "student" && studentData && <StudentAnalytics copy={copy} data={studentData} />}
      </section>
    </main>
  );
}

function TeacherAnalytics({ copy, data }: { copy: typeof translations.en; data: TeacherDashboardData }) {
  const maxKeywordCount = Math.max(1, ...data.topKeywords.map((topic) => topic.count));
  const riskTotal = Math.max(1, data.riskSummary.low + data.riskSummary.medium + data.riskSummary.high);
  return (
    <>
      <StatTile label={copy.totalQuestions} value={data.summary.totalQuestions} />
      <StatTile label={copy.uniqueStudents} value={data.summary.uniqueStudents} />
      <StatTile label={copy.averageRisk} value={`${data.summary.averageRisk}%`} />
      <section className="analytics-panel wide">
        <h2>{copy.topTopics}</h2>
        {data.topKeywords.length ? (
          <div className="bar-list">
            {data.topKeywords.map((topic) => (
              <div className="bar-row" key={topic.keyword}>
                <span>{topic.keyword}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(topic.count / maxKeywordCount) * 100}%` }} />
                </div>
                <small>
                  {topic.count} {copy.questions} · {copy.risk} {topic.averageRisk}%
                </small>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-inline">{copy.noData}</p>
        )}
      </section>
      <section className="analytics-panel">
        <h2>{copy.riskOverview}</h2>
        <div className="risk-stack">
          <span className="risk-low" style={{ width: `${(data.riskSummary.low / riskTotal) * 100}%` }} />
          <span className="risk-medium" style={{ width: `${(data.riskSummary.medium / riskTotal) * 100}%` }} />
          <span className="risk-high" style={{ width: `${(data.riskSummary.high / riskTotal) * 100}%` }} />
        </div>
        <div className="risk-legend">
          <span>{copy.lowRisk}: {data.riskSummary.low}</span>
          <span>{copy.mediumRisk}: {data.riskSummary.medium}</span>
          <span>{copy.highRisk}: {data.riskSummary.high}</span>
        </div>
      </section>
      <section className="analytics-panel wide">
        <h2>{copy.recentQuestions}</h2>
        <div className="qa-list">
          {data.recentQuestions.length ? (
            data.recentQuestions.map((item) => (
              <article key={item.id}>
                <strong>{item.studentName}</strong>
                <p>{item.question}</p>
                <small>{item.keyword} · {copy.risk} {item.riskScore}%</small>
              </article>
            ))
          ) : (
            <p className="empty-inline">{copy.noData}</p>
          )}
        </div>
      </section>
    </>
  );
}

function StudentAnalytics({ copy, data }: { copy: typeof translations.en; data: StudentDashboardData }) {
  const maxKeywordCount = Math.max(1, ...data.topKeywords.map((topic) => topic.count));
  return (
    <>
      <StatTile label={copy.totalQuestions} value={data.summary.totalQuestions} />
      <StatTile label={copy.answers} value={data.summary.totalAnswers} />
      <StatTile label={copy.conversations} value={data.summary.totalConversations} />
      <section className="analytics-panel wide">
        <h2>{copy.topTopics}</h2>
        {data.topKeywords.length ? (
          <div className="bar-list">
            {data.topKeywords.map((topic) => (
              <div className="bar-row" key={topic.keyword}>
                <span>{topic.keyword}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(topic.count / maxKeywordCount) * 100}%` }} />
                </div>
                <small>
                  {topic.count} {copy.questions}
                </small>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-inline">{copy.noData}</p>
        )}
      </section>
      <section className="analytics-panel wide">
        <h2>{copy.recentQa}</h2>
        <div className="qa-list">
          {data.recentQa.length ? (
            data.recentQa.map((item) => (
              <article key={item.id}>
                <strong>{item.keyword}</strong>
                <p>{item.question}</p>
                <small>{item.answer || copy.noData}</small>
              </article>
            ))
          ) : (
            <p className="empty-inline">{copy.noData}</p>
          )}
        </div>
      </section>
    </>
  );
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat-tile">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function Alert({ tone, message }: { tone: "error" | "success"; message: string }) {
  return (
    <div className={`alert ${tone}`} role={tone === "error" ? "alert" : "status"}>
      <span className="alert-icon">{tone === "error" ? "!" : "✓"}</span>
      <p>{message}</p>
    </div>
  );
}

function isGreetingInput(value: string) {
  return /^(hi|hello|hey|pershendetje|tung|ckemi|c kemi|miremengjes|miredita|mirembrema)$/i.test(
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/gi, " ")
      .trim()
  );
}

function chatErrorMessage(err: unknown, fallback: string, serverProblem: string) {
  if (err instanceof Error && err.message === "SERVER_UNAVAILABLE") {
    return serverProblem;
  }
  return err instanceof Error ? err.message : fallback;
}

function documentDisplayTitle(item: TeacherDocument) {
  const match = item.lessonId?.match(/^MAT(\d+)_(\d{3})$/);
  if (!match) {
    return item.lessonId || item.id;
  }
  return `Matematika klasa ${Number(match[1])} - Mësimi ${Number(match[2])}`;
}

function searchableDocumentText(item: TeacherDocument) {
  return [documentDisplayTitle(item), item.lessonId, item.folder, item.summary]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function StudentChat({ copy, token }: { copy: typeof translations.en; token: string }) {
  const [question, setQuestion] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const currentQuestion = question.trim();
    if (!currentQuestion) return;
    if (currentQuestion.length < 3 && !isGreetingInput(currentQuestion)) {
      setError(copy.questionTooShort);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await askStudentChat(token, currentQuestion, conversationId);
      setConversationId(response.conversation.id);
      setQuestion("");
      setMessages((current) => [...current, { role: "student", content: currentQuestion }]);
      const answer = response.messages.find((message) => message.role === "assistant");
      if (answer) {
        setMessages((current) => [...current, answer]);
      }
    } catch (err) {
      setError(chatErrorMessage(err, copy.chatbotFailed, copy.chatbotServerProblem));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ChatShell copy={copy} title={copy.studentChatTitle} subtitle={copy.studentChatSubtitle} tip={copy.studentChatTip}>
      <MessageList messages={messages} emptyText={copy.studentEmpty} />
      {error && <Alert tone="error" message={error} />}
      <form className="composer" onSubmit={submit}>
        <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={copy.studentPlaceholder} />
        <button className="primary" disabled={loading}>
          {loading ? copy.sending : copy.send}
        </button>
      </form>
    </ChatShell>
  );
}

function TeacherAssistant({ copy, token }: { copy: typeof translations.en; token: string }) {
  const [message, setMessage] = useState("Dua te gjeneroj ditare per matematiken klasa 7");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [provider, setProvider] = useState<"fake" | "anthropic">("fake");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const currentMessage = message.trim();
    if (!currentMessage) return;
    setMessages((current) => [...current, { role: "teacher", content: currentMessage }]);
    setLoading(true);
    setError("");
    try {
      const response = await createTeacherDitare(token, {
        message: currentMessage,
        provider,
        force: false,
        render: true
      });
      const details = [
        response.assistant,
        response.run.status === "completed" || response.batch ? copy.generatedDocumentsReady : ""
      ]
        .filter(Boolean)
        .join("\n");
      setMessages((current) => [...current, { role: "assistant", content: details }]);
    } catch (err) {
      setError(chatErrorMessage(err, copy.teacherFailed, copy.teacherServerProblem));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ChatShell copy={copy} title={copy.teacherChatTitle} subtitle={copy.teacherChatSubtitle} tip={copy.teacherChatTip}>
      <div className="toolbar">
        <span>{copy.provider}</span>
        <div className="segmented compact">
          <button type="button" className={provider === "fake" ? "active" : ""} onClick={() => setProvider("fake")}>
            {copy.local}
          </button>
          <button
            type="button"
            className={provider === "anthropic" ? "active" : ""}
            onClick={() => setProvider("anthropic")}
          >
            {copy.anthropic}
          </button>
        </div>
      </div>
      <MessageList messages={messages} emptyText={copy.teacherEmpty} />
      {error && <Alert tone="error" message={error} />}
      <form className="composer" onSubmit={submit}>
        <input value={message} onChange={(event) => setMessage(event.target.value)} />
        <button className="primary" disabled={loading}>
          {loading ? copy.generating : copy.generate}
        </button>
      </form>
    </ChatShell>
  );
}

function TeacherDocuments({ copy, token }: { copy: typeof translations.en; token: string }) {
  const [documents, setDocuments] = useState<TeacherDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState("");
  const [visibleByFolder, setVisibleByFolder] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const initialDocumentLimit = 12;
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const visibleDocuments = normalizedSearch
    ? documents.filter((document) => searchableDocumentText(document).includes(normalizedSearch))
    : documents;
  const groupedDocuments = visibleDocuments.reduce<Array<{ folder: string; items: TeacherDocument[] }>>((groups, document) => {
    const folder = document.folder || copy.otherDocuments;
    const existing = groups.find((group) => group.folder === folder);
    if (existing) {
      existing.items.push(document);
    } else {
      groups.push({ folder, items: [document] });
    }
    return groups;
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadDocuments() {
      setLoading(true);
      setError("");
      try {
        const response = await listTeacherDocuments(token);
        if (!cancelled) setDocuments(response.documents);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : copy.teacherFailed);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadDocuments();
    return () => {
      cancelled = true;
    };
  }, [copy.teacherFailed, token]);

  async function deleteDocument(id: string) {
    if (confirmingDeleteId !== id) {
      setConfirmingDeleteId(id);
      return;
    }

    setDeletingId(id);
    setError("");
    try {
      await deleteTeacherDocument(token, id);
      setDocuments((current) => current.filter((item) => item.id !== id));
      setConfirmingDeleteId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.deleteDocumentFailed);
    } finally {
      setDeletingId("");
    }
  }

  function showMoreDocuments(folder: string) {
    setVisibleByFolder((current) => ({
      ...current,
      [folder]: (current[folder] || initialDocumentLimit) + initialDocumentLimit
    }));
  }

  return (
    <main className="workspace">
      <section className="page-heading">
        <p className="eyebrow">{copy.teacherAssistantTile}</p>
        <h1>{copy.documents}</h1>
        <p>{copy.documentsSubtitle}</p>
      </section>
      {error && <Alert tone="error" message={error} />}
      <section className="documents-layout">
        <aside className="documents-info">
          <div className="chat-info-icon">ƒ</div>
          <h2>{copy.documents}</h2>
          <p>{copy.documentTip}</p>
        </aside>
        <div className="documents-grid">
          <div className="document-search">
            <input
              aria-label={copy.searchDocuments}
              placeholder={copy.searchDocumentsPlaceholder}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
          {loading && <p className="empty-inline">{copy.working}</p>}
          {!loading && !documents.length && <p className="empty-inline">{copy.noDocuments}</p>}
          {!loading && documents.length > 0 && !visibleDocuments.length && (
            <p className="empty-inline">{copy.noDocumentSearchResults}</p>
          )}
          {groupedDocuments.map((group) => (
            <section className="document-folder" key={group.folder}>
              <div className="document-folder-heading">
                <span className="document-folder-icon" aria-label={copy.mathFolderIconLabel}>
                  <span>π</span>
                  <small >Math</small>
                </span>
                <div>
                  <h2>{group.folder}</h2>
                  <p>{group.items.length} {group.items.length === 1 ? copy.documentFile : copy.documentFiles}</p>
                </div>
              </div>
              <div className="document-folder-grid">
                {group.items.slice(0, visibleByFolder[group.folder] || initialDocumentLimit).map((item) => (
                  <article className="document-card" key={item.id}>
                    <div>
                      <small>{copy.createdAt}: {new Date(item.createdAt).toLocaleDateString()}</small>
                      <h2>{documentDisplayTitle(item)}</h2>
                      {item.lessonId && <small>{item.lessonId}</small>}
                      <p>{item.summary || `${copy.documentLesson}: ${item.lessonId || item.id}`}</p>
                    </div>
                    <div className="document-actions">
                      {item.hasDocx && (
                        <a
                          className="download-button primary"
                          download
                          href={teacherDocumentDownloadUrl(item.id, item.downloadToken)}
                        >
                          {copy.downloadDocx}
                        </a>
                      )}
                      <button
                        className={`delete-button ${confirmingDeleteId === item.id ? "confirm" : ""}`}
                        disabled={deletingId === item.id}
                        onClick={() => deleteDocument(item.id)}
                        type="button"
                      >
                        {deletingId === item.id
                          ? copy.working
                          : confirmingDeleteId === item.id
                            ? copy.confirmDeleteDocument
                            : copy.deleteDocument}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              {group.items.length > (visibleByFolder[group.folder] || initialDocumentLimit) && (
                <button className="load-more-button" type="button" onClick={() => showMoreDocuments(group.folder)}>
                  {copy.loadMoreDocuments}
                </button>
              )}
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}

function ChatShell({
  copy,
  title,
  subtitle,
  tip,
  children
}: {
  copy: typeof translations.en;
  title: string;
  subtitle: string;
  tip: string;
  children: React.ReactNode;
}) {
  return (
    <main className="chat-page">
      <section className="page-heading">
        <p className="eyebrow">{copy.amathintChat}</p>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </section>
      <section className="chat-layout">
        <aside className="chat-info-card">
          <div className="chat-info-icon">π</div>
          <h2>{copy.chatTipTitle}</h2>
          <p>{tip}</p>
        </aside>
        <section className="chat-surface">{children}</section>
      </section>
    </main>
  );
}

function MessageList({ messages, emptyText }: { messages: ChatMessage[]; emptyText: string }) {
  const visibleMessages = useMemo(() => messages, [messages]);
  return (
    <div className="messages">
      {!visibleMessages.length && <p className="empty">{emptyText}</p>}
      {visibleMessages.map((message, index) => (
        <div className={`message ${message.role === "assistant" ? "assistant" : "user"}`} key={`${message.role}-${index}`}>
          <span>{message.role}</span>
          <p>{message.content}</p>
          {message.provider && <small>{message.provider} · {message.model}</small>}
        </div>
      ))}
    </div>
  );
}

export default App;
