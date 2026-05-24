import type { TeacherDocument } from "../api";

export const folderAliasStorageKey = "amathint_teacher_folder_aliases";

export function documentDisplayTitle(item: TeacherDocument) {
  const match = item.lessonId?.match(/^MAT(\d+)_(\d{3})$/);
  if (!match) {
    return item.lessonId || item.id;
  }
  return `Matematika klasa ${Number(match[1])} - Mësimi ${Number(match[2])}`;
}

export function searchableDocumentText(item: TeacherDocument) {
  return [documentDisplayTitle(item), item.lessonId, item.folder, item.summary]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function loadFolderAliases() {
  try {
    const parsed = JSON.parse(localStorage.getItem(folderAliasStorageKey) || "{}");
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}
