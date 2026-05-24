import { useEffect, useState } from "react";
import {
  type TeacherDocument,
  deleteTeacherDocument,
  deleteTeacherDocumentFolder,
  listTeacherDocuments,
  teacherDocumentDownloadUrl
} from "../api";
import { Alert } from "../components/Alert";
import type { TranslationCopy } from "../i18n";
import { documentDisplayTitle, folderAliasStorageKey, loadFolderAliases, searchableDocumentText } from "../utils/documents";

export function TeacherDocuments({ copy, token }: { copy: TranslationCopy; token: string }) {
  const [documents, setDocuments] = useState<TeacherDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState("");
  const [deletingFolder, setDeletingFolder] = useState("");
  const [confirmingDeleteFolder, setConfirmingDeleteFolder] = useState("");
  const [renamingFolder, setRenamingFolder] = useState("");
  const [folderDraft, setFolderDraft] = useState("");
  const [folderAliases, setFolderAliases] = useState<Record<string, string>>(() => loadFolderAliases());
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const [visibleByFolder, setVisibleByFolder] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const initialDocumentLimit = 12;
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const visibleDocuments = normalizedSearch
    ? documents.filter((document) => {
        const originalFolder = document.folder || copy.otherDocuments;
        return [searchableDocumentText(document), folderAliases[originalFolder]]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);
      })
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
    localStorage.setItem(folderAliasStorageKey, JSON.stringify(folderAliases));
  }, [folderAliases]);

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

  async function deleteFolder(folder: string) {
    if (confirmingDeleteFolder !== folder) {
      setConfirmingDeleteFolder(folder);
      return;
    }

    setDeletingFolder(folder);
    setError("");
    try {
      await deleteTeacherDocumentFolder(token, folder);
      setDocuments((current) => current.filter((item) => (item.folder || copy.otherDocuments) !== folder));
      setFolderAliases((current) => {
        const next = { ...current };
        delete next[folder];
        return next;
      });
      setConfirmingDeleteFolder("");
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.deleteFolderFailed);
    } finally {
      setDeletingFolder("");
    }
  }

  function startRenamingFolder(folder: string) {
    setRenamingFolder(folder);
    setFolderDraft(folderAliases[folder] || folder);
  }

  function saveFolderName(folder: string) {
    const nextName = folderDraft.trim();
    if (!nextName || nextName === folder) {
      setFolderAliases((current) => {
        const next = { ...current };
        delete next[folder];
        return next;
      });
    } else {
      setFolderAliases((current) => ({ ...current, [folder]: nextName }));
    }
    setRenamingFolder("");
    setFolderDraft("");
  }

  function toggleFolder(folder: string) {
    setCollapsedFolders((current) => ({ ...current, [folder]: !current[folder] }));
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
                  <small>Math</small>
                </span>
                <div>
                  {renamingFolder === group.folder ? (
                    <div className="folder-rename">
                      <input
                        aria-label={copy.folderName}
                        value={folderDraft}
                        onChange={(event) => setFolderDraft(event.target.value)}
                      />
                      <button type="button" className="icon-action save" onClick={() => saveFolderName(group.folder)}>
                        {copy.saveChanges}
                      </button>
                    </div>
                  ) : (
                    <h2>{folderAliases[group.folder] || group.folder}</h2>
                  )}
                  <p>{group.items.length} {group.items.length === 1 ? copy.documentFile : copy.documentFiles}</p>
                  {folderAliases[group.folder] && <small>{group.folder}</small>}
                </div>
                <div className="folder-actions">
                  <button type="button" className="outline small" onClick={() => toggleFolder(group.folder)}>
                    {collapsedFolders[group.folder] ? copy.expandFolder : copy.collapseFolder}
                  </button>
                  <button type="button" className="outline small" onClick={() => startRenamingFolder(group.folder)}>
                    {copy.renameFolder}
                  </button>
                  <button
                    className={`delete-button small ${confirmingDeleteFolder === group.folder ? "confirm" : ""}`}
                    disabled={deletingFolder === group.folder}
                    onClick={() => deleteFolder(group.folder)}
                    type="button"
                  >
                    {deletingFolder === group.folder
                      ? copy.working
                      : confirmingDeleteFolder === group.folder
                        ? copy.confirmDeleteFolder
                        : copy.deleteFolder}
                  </button>
                </div>
              </div>
              {!collapsedFolders[group.folder] && (
                <>
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
                </>
              )}
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}
