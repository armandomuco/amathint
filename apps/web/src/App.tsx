import { useEffect, useState } from "react";
import { type AuthResponse, getMe } from "./api";
import { Header } from "./components/Header";
import { type Language, translations } from "./i18n";
import { AuthPage } from "./pages/AuthPage";
import { StudentChat, TeacherAssistant } from "./pages/Chat";
import { Dashboard } from "./pages/Dashboard";
import { Landing } from "./pages/Landing";
import { ProfilePage } from "./pages/ProfilePage";
import { StudentHistory } from "./pages/StudentHistory";
import { TeacherDocuments } from "./pages/TeacherDocuments";
import type { View } from "./types";

const savedAuth = localStorage.getItem("amathint_auth");
const savedLanguage = localStorage.getItem("amathint_language") as Language | null;

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
      {view === "student-history" && auth && auth.user.role === "student" && (
        <StudentHistory copy={copy} token={auth.token} />
      )}
      {view === "teacher-assistant" && auth && <TeacherAssistant copy={copy} token={auth.token} />}
      {view === "teacher-documents" && auth && auth.user.role === "teacher" && (
        <TeacherDocuments copy={copy} token={auth.token} />
      )}
    </div>
  );
}

export default App;
