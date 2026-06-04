import type { AuthResponse } from "../api";
import { type Language, languageNames, type TranslationCopy } from "../i18n";
import type { View } from "../types";
import { Wordmark } from "./Wordmark";

export function Header({
  auth,
  copy,
  language,
  setLanguage,
  setView,
  view,
  logout
}: {
  auth: AuthResponse | null;
  copy: TranslationCopy;
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
              <span className="language-flag">{languageNames[item].split(" ")[0]}</span>
              <span className="language-code">{languageNames[item].split(" ")[1]}</span>
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
            {auth.user.role === "student" && (
              <button
                className={view === "student-history" ? "active" : ""}
                onClick={() => setView("student-history")}
              >
                {copy.navHistory}
              </button>
            )}
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
