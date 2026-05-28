import { useEffect, useState } from "react";
import { type AuthResponse, type StudentDashboardData, type TeacherDashboardData, getStudentDashboard, getTeacherDashboard } from "../api";
import { Alert } from "../components/Alert";
import type { TranslationCopy } from "../i18n";
import type { View } from "../types";

export function Dashboard({ auth, copy, setView }: { auth: AuthResponse; copy: TranslationCopy; setView: (view: View) => void }) {
  const action = auth.user.role === "student" ? "student-chat" : "teacher-assistant";
  const [teacherData, setTeacherData] = useState<TeacherDashboardData | null>(null);
  const [studentData, setStudentData] = useState<StudentDashboardData | null>(null);
  const [selectedTeacherGrade, setSelectedTeacherGrade] = useState<number | null>(
    auth.user.role === "teacher" ? auth.user.teacherGrades?.[0] || null : null
  );
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadDashboard() {
      setError("");
      try {
        if (auth.user.role === "teacher") {
          const data = await getTeacherDashboard(auth.token, selectedTeacherGrade);
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
  }, [auth.token, auth.user.role, selectedTeacherGrade]);

  return (
    <main className="workspace">
      <section className="page-heading">
        <p className="eyebrow">{auth.user.schoolName || auth.user.schoolIdentifier}</p>
        <h1>{auth.user.role === "student" ? copy.studentDashboard : copy.teacherDashboard}</h1>
        <p>
          {copy.welcome}, {auth.user.name}. {copy.dashboardNext}
        </p>
      </section>
      {error && <Alert tone="error" message={error} />}
      {auth.user.role === "teacher" && Boolean(auth.user.teacherGrades?.length) && (
        <section className="class-tabs" aria-label={copy.teacherGrades}>
          {auth.user.teacherGrades.map((grade) => (
            <button
              className={selectedTeacherGrade === grade ? "active" : ""}
              key={grade}
              onClick={() => setSelectedTeacherGrade(grade)}
              type="button"
            >
              {copy.classLabel} {grade}
            </button>
          ))}
        </section>
      )}
      <section className={`dashboard-grid ${auth.user.role === "teacher" ? "teacher-dashboard-grid" : "student-dashboard-grid"}`}>
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

function TeacherAnalytics({ copy, data }: { copy: TranslationCopy; data: TeacherDashboardData }) {
  const maxKeywordCount = Math.max(1, ...data.topKeywords.map((topic) => topic.count));
  const riskTotal = Math.max(1, data.riskSummary.low + data.riskSummary.medium + data.riskSummary.high);
  const availableGradeValues = data.summary.availableGrades || [];
  const availableGrades = availableGradeValues.length
    ? availableGradeValues.map((grade) => `${copy.classLabel} ${grade}`).join(", ")
    : copy.noData;
  return (
    <>
      <StatTile label={copy.totalQuestions} value={data.summary.totalQuestions} />
      <StatTile label={copy.uniqueStudents} value={data.summary.uniqueStudents} />
      <StatTile label={copy.averageRisk} value={`${data.summary.averageRisk}%`} />
      <section className="analytics-panel available-grades-panel">
        <h2>{copy.availableDitareGrades}</h2>
        <p className="analytics-note">{availableGrades}</p>
        <small>{copy.availableDitareGradesHelp}</small>
      </section>
      <section className="analytics-panel wide top-topics-panel">
        <h2>{copy.topTopics}</h2>
        <p className="analytics-note">{copy.topicCalculationHelp}</p>
        {data.topKeywords.length ? (
          <div className="bar-list">
            {data.topKeywords.slice(0, 5).map((topic) => (
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
      <section className="analytics-panel risk-panel">
        <h2>{copy.riskOverview}</h2>
        <p className="analytics-note">{copy.riskCalculationHelp}</p>
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
        <small>{copy.riskSignalHelp}</small>
      </section>
      <section className="analytics-panel wide recent-questions-panel">
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

function StudentAnalytics({ copy, data }: { copy: TranslationCopy; data: StudentDashboardData }) {
  const maxKeywordCount = Math.max(1, ...data.topKeywords.map((topic) => topic.count));
  return (
    <>
      <StatTile label={copy.totalQuestions} value={data.summary.totalQuestions} />
      <StatTile label={copy.answers} value={data.summary.totalAnswers} />
      <StatTile label={copy.conversations} value={data.summary.totalConversations} />
      <section className="analytics-panel wide">
        <h2>{copy.topTopics}</h2>
        <p className="analytics-note">{copy.studentTopicCalculationHelp}</p>
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
        <p className="analytics-note">{copy.recentQaLimitHelp}</p>
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
