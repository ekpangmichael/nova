const STORAGE_KEY = "nova:last-board-project-id";
const CHANGE_EVENT = "nova:board-project-change";

export const getStoredBoardProjectId = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(STORAGE_KEY);
  return value?.trim() || null;
};

export const setStoredBoardProjectId = (projectId: string) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = projectId.trim();

  if (!normalized) {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { projectId: null } }));
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, normalized);
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { projectId: normalized } }));
};

export const onStoredBoardProjectIdChange = (
  callback: (projectId: string | null) => void
) => {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      callback(event.newValue?.trim() || null);
    }
  };

  const handleChange = (event: Event) => {
    const projectId =
      event instanceof CustomEvent && typeof event.detail?.projectId === "string"
        ? event.detail.projectId
        : null;

    callback(projectId);
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(CHANGE_EVENT, handleChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(CHANGE_EVENT, handleChange);
  };
};
