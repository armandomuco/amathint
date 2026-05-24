import { type FormEvent, useState } from "react";
import { type AuthResponse, type Role, login, signup } from "../api";
import { Alert } from "../components/Alert";
import type { TranslationCopy } from "../i18n";
import type { View } from "../types";
import { isValidEmail } from "../utils/validation";

export function AuthPage({
  copy,
  mode,
  saveAuth,
  setView
}: {
  copy: TranslationCopy;
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
