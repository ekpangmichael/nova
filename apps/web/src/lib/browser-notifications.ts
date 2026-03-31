"use client";

export type BrowserNotificationPreferences = {
  enabled: boolean;
  taskCompleted: boolean;
  errors: boolean;
  comments: boolean;
};

export type BrowserNotificationPermissionState = NotificationPermission | "unsupported";

export const DEFAULT_BROWSER_NOTIFICATION_PREFERENCES: BrowserNotificationPreferences = {
  enabled: true,
  taskCompleted: true,
  errors: true,
  comments: false,
};

const STORAGE_KEY = "nova.browser-notification-preferences";
const CHANGE_EVENT = "nova:browser-notification-preferences-changed";

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isBrowserNotificationSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function readBrowserNotificationPermission(): BrowserNotificationPermissionState {
  if (!isBrowserNotificationSupported()) {
    return "unsupported";
  }

  return Notification.permission;
}

export function readBrowserNotificationPreferences(): BrowserNotificationPreferences {
  if (typeof window === "undefined") {
    return DEFAULT_BROWSER_NOTIFICATION_PREFERENCES;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return DEFAULT_BROWSER_NOTIFICATION_PREFERENCES;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!isObjectLike(parsed)) {
      return DEFAULT_BROWSER_NOTIFICATION_PREFERENCES;
    }

    return {
      enabled:
        typeof parsed.enabled === "boolean"
          ? parsed.enabled
          : DEFAULT_BROWSER_NOTIFICATION_PREFERENCES.enabled,
      taskCompleted:
        typeof parsed.taskCompleted === "boolean"
          ? parsed.taskCompleted
          : DEFAULT_BROWSER_NOTIFICATION_PREFERENCES.taskCompleted,
      errors:
        typeof parsed.errors === "boolean"
          ? parsed.errors
          : DEFAULT_BROWSER_NOTIFICATION_PREFERENCES.errors,
      comments:
        typeof parsed.comments === "boolean"
          ? parsed.comments
          : DEFAULT_BROWSER_NOTIFICATION_PREFERENCES.comments,
    };
  } catch {
    return DEFAULT_BROWSER_NOTIFICATION_PREFERENCES;
  }
}

export function writeBrowserNotificationPreferences(
  preferences: BrowserNotificationPreferences
) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  window.dispatchEvent(new CustomEvent<BrowserNotificationPreferences>(CHANGE_EVENT, {
    detail: preferences,
  }));
}

export function subscribeToBrowserNotificationPreferences(
  onChange: (preferences: BrowserNotificationPreferences) => void
) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleChange = (event: Event) => {
    const customEvent = event as CustomEvent<BrowserNotificationPreferences>;
    onChange(customEvent.detail ?? readBrowserNotificationPreferences());
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key && event.key !== STORAGE_KEY) {
      return;
    }

    onChange(readBrowserNotificationPreferences());
  };

  window.addEventListener(CHANGE_EVENT, handleChange as EventListener);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(CHANGE_EVENT, handleChange as EventListener);
    window.removeEventListener("storage", handleStorage);
  };
}

export async function requestBrowserNotificationPermission() {
  if (!isBrowserNotificationSupported()) {
    return "unsupported" as const;
  }

  return Notification.requestPermission();
}
