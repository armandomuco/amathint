import { useEffect, useMemo, useState } from "react";
import { type StudentHistoryItem, listStudentHistory } from "../api";
import { Alert } from "../components/Alert";
import type { TranslationCopy } from "../i18n";

export function StudentHistory({ copy, token }: { copy: TranslationCopy; token: string }) {
  const [history, setHistory] = useState<StudentHistoryItem[]>([]);
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(8);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const historyPageSize = 8;

  useEffect(() => {
    let cancelled = false;
    async function loadHistory() {
      setLoading(true);
      setError("");
      try {
        const response = await listStudentHistory(token);
        if (!cancelled) setHistory(response.history);
      } catch {
        if (!cancelled) setError(copy.chatbotFailed);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [copy.chatbotFailed, token]);

  const filteredHistory = useMemo(() => {
    const normalizedSearch = search.toLowerCase().trim();
    if (!normalizedSearch) return history;
    return history.filter((item) =>
      `${item.question} ${item.answer} ${item.keyword} ${item.conversationTitle}`.toLowerCase().includes(normalizedSearch)
    );
  }, [history, search]);
  const visibleHistory = filteredHistory.slice(0, visibleCount);

  useEffect(() => {
    setVisibleCount(historyPageSize);
  }, [search]);

  return (
    <main className="workspace">
      <section className="page-heading">
        <p className="eyebrow">{copy.studentChatTile}</p>
        <h1>{copy.studentHistoryTitle}</h1>
        <p>{copy.studentHistorySubtitle}</p>
      </section>
      {error && <Alert tone="error" message={error} />}
      <section className="documents-layout">
        <aside className="documents-info">
          <div className="chat-info-icon">∑</div>
          <h2>{copy.chatTipTitle}</h2>
          <p>{copy.studentHistoryTip}</p>
        </aside>
        <div className="documents-grid">
          <label className="document-search">
            {copy.searchHistory}
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={copy.searchHistoryPlaceholder}
            />
          </label>
          {loading && <p className="empty-inline">{copy.working}</p>}
          {!loading && !history.length && <p className="empty-inline">{copy.noHistory}</p>}
          {!loading && Boolean(history.length) && !filteredHistory.length && (
            <p className="empty-inline">{copy.noHistorySearchResults}</p>
          )}
          <div className="history-list">
            {visibleHistory.map((item) => (
              <article className="history-card" key={item.id}>
                <div>
                  <span className="history-keyword">{item.keyword}</span>
                  <small>
                    {copy.askedOn} {new Date(item.createdAt).toLocaleDateString()}
                  </small>
                </div>
                <h2>{item.question}</h2>
                <p>{item.answer || copy.noData}</p>
              </article>
            ))}
          </div>
          {filteredHistory.length > visibleCount && (
            <button
              className="load-more-button"
              type="button"
              onClick={() => setVisibleCount((current) => current + historyPageSize)}
            >
              {copy.loadMoreDocuments}
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
