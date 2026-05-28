import { type FormEvent, useEffect, useState } from "react";
import { type AuthResponse, type School, listSchools, updateProfile } from "../api";
import { Alert } from "../components/Alert";
import { StudentGradeSelect, TeacherGradeMultiSelect } from "../components/GradePicker";
import { SchoolSelect } from "../components/SchoolSelect";
import type { TranslationCopy } from "../i18n";
import { isValidEmail } from "../utils/validation";

export function ProfilePage({
  auth,
  copy,
  updateSavedAuth
}: {
  auth: AuthResponse;
  copy: TranslationCopy;
  updateSavedAuth: (auth: AuthResponse) => void;
}) {
  const [name, setName] = useState(auth.user.name);
  const [email, setEmail] = useState(auth.user.email);
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolId, setSchoolId] = useState(auth.user.schoolId || auth.user.schoolIdentifier);
  const [studentGrade, setStudentGrade] = useState<number | null>(auth.user.studentGrade || null);
  const [teacherGrades, setTeacherGrades] = useState<number[]>(auth.user.teacherGrades || []);
  const [status, setStatus] = useState("");
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
        if (!cancelled) setSchools(response.schools);
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
    setStatus("");
    setError("");

    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const hasClassAccess = auth.user.role === "student" ? Boolean(studentGrade) : teacherGrades.length > 0;
    if (cleanName.length < 2 || !schoolId || !hasClassAccess || !isValidEmail(cleanEmail)) {
      setError(copy.profileValidation);
      return;
    }

    setLoading(true);
    try {
      const response = await updateProfile(auth.token, {
        name: cleanName,
        email: cleanEmail,
        schoolId,
        studentGrade,
        teacherGrades
      });
      updateSavedAuth({
        ...auth,
        user: response.user
      });
      setStatus(copy.profileSaved);
    } catch {
      setError(copy.profileFailed);
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
          <SchoolSelect copy={copy} schools={schools} selectedSchoolId={schoolId} onChange={setSchoolId} />
          <div className="profile-form-wide">
            {auth.user.role === "student" ? (
              <StudentGradeSelect copy={copy} grades={allowedGrades} value={studentGrade} onChange={setStudentGrade} />
            ) : (
              <TeacherGradeMultiSelect copy={copy} grades={allowedGrades} values={teacherGrades} onChange={setTeacherGrades} />
            )}
          </div>
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
              <dd>{auth.user.schoolName || auth.user.schoolIdentifier}</dd>
            </div>
            <div>
              <dt>{copy.classAccess}</dt>
              <dd>
                {auth.user.role === "student"
                  ? `${copy.classLabel} ${auth.user.studentGrade || "-"}`
                  : (auth.user.teacherGrades || []).map((grade) => `${copy.classLabel} ${grade}`).join(", ") || "-"}
              </dd>
            </div>
          </dl>
        </aside>
      </section>
    </main>
  );
}
