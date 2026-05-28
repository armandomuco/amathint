import { type FormEvent, useEffect, useState } from "react";
import { type AuthResponse, type Role, type School, listSchools, login, signup } from "../api";
import { Alert } from "../components/Alert";
import { StudentGradeSelect, TeacherGradeMultiSelect } from "../components/GradePicker";
import { SchoolSelect } from "../components/SchoolSelect";
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
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolId, setSchoolId] = useState("");
  const [studentGrade, setStudentGrade] = useState<number | null>(null);
  const [teacherGrades, setTeacherGrades] = useState<number[]>([]);
  const [role, setRole] = useState<Role>("student");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const selectedSchool = schools.find((school) => school.id === schoolId);
  const allowedGrades = selectedSchool
    ? selectedSchool.level === "high"
      ? [10, 11, 12]
      : [1, 2, 3, 4, 5, 6, 7, 8, 9]
    : Array.from({ length: 12 }, (_, index) => index + 1);

  useEffect(() => {
    let cancelled = false;
    listSchools()
      .then((response) => {
        if (!cancelled) {
          setSchools(response.schools);
        }
      })
      .catch(() => {
        if (!cancelled) setError(copy.schoolsLoadFailed);
      });
    return () => {
      cancelled = true;
    };
  }, [copy.schoolsLoadFailed]);

  useEffect(() => {
    if (!selectedSchool) return;
    if (studentGrade && !allowedGrades.includes(studentGrade)) {
      setStudentGrade(null);
    }
    if (teacherGrades.some((grade) => !allowedGrades.includes(grade))) {
      setTeacherGrades((grades) => grades.filter((grade) => allowedGrades.includes(grade)));
    }
  }, [allowedGrades.join(","), selectedSchool, studentGrade, teacherGrades]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");

    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();
    const hasClassAccess = role === "student" ? Boolean(studentGrade) : teacherGrades.length > 0;
    if (
      !isValidEmail(cleanEmail) ||
      cleanPassword.length < 6 ||
      (mode === "signup" && (cleanName.length < 2 || !schoolId || !hasClassAccess))
    ) {
      setError(mode === "signup" ? copy.signupValidation : copy.authValidation);
      return;
    }

    setLoading(true);
    try {
      const response =
        mode === "signup"
          ? await signup({ name: cleanName, email: cleanEmail, password: cleanPassword, role, schoolId, studentGrade, teacherGrades })
          : await login({ email: cleanEmail, password: cleanPassword });
      saveAuth(response);
    } catch {
      setError(copy.authFailed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-layout">
      <img className="auth-bg-logo" src="/amathint-logo.svg" alt="" />
      <section className={`auth-panel ${mode === "signup" ? "auth-panel-wide" : ""}`}>
        <p className="eyebrow">{mode === "signup" ? copy.createAccess : copy.welcomeBack}</p>
        <h1>{mode === "signup" ? copy.signUp : copy.signIn}</h1>
        <form className={mode === "signup" ? "auth-form-grid" : ""} onSubmit={submit} noValidate>
          {mode === "signup" && (
            <>
              <label>
                {copy.fullName}
                <input value={name} onChange={(event) => setName(event.target.value)} />
              </label>
              <SchoolSelect copy={copy} schools={schools} selectedSchoolId={schoolId} onChange={setSchoolId} />
              <div className="segmented">
                <button type="button" className={role === "student" ? "active" : ""} onClick={() => setRole("student")}>
                  {copy.student}
                </button>
                <button type="button" className={role === "teacher" ? "active" : ""} onClick={() => setRole("teacher")}>
                  {copy.teacher}
                </button>
              </div>
              <div className="auth-form-wide">
                {role === "student" ? (
                  <StudentGradeSelect copy={copy} grades={allowedGrades} value={studentGrade} onChange={setStudentGrade} />
                ) : (
                  <TeacherGradeMultiSelect copy={copy} grades={allowedGrades} values={teacherGrades} onChange={setTeacherGrades} />
                )}
              </div>
            </>
          )}
          <label className={mode === "signup" ? "" : undefined}>
            {copy.email}
            <input inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className={mode === "signup" ? "" : undefined}>
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
          {error && <div className="auth-form-wide"><Alert tone="error" message={error} /></div>}
          <button className="primary full auth-form-wide" disabled={loading}>
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
