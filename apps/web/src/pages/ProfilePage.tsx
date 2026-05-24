import { type FormEvent, useState } from "react";
import { type AuthResponse, updateProfile } from "../api";
import { Alert } from "../components/Alert";
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
