import type { TranslationCopy } from "../i18n";
import type { View } from "../types";
import { Wordmark } from "../components/Wordmark";

export function Landing({ copy, setView }: { copy: TranslationCopy; setView: (view: View) => void }) {
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
