"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_BROWSER_NOTIFICATION_PREFERENCES,
  isBrowserNotificationSupported,
  readBrowserNotificationPermission,
  readBrowserNotificationPreferences,
  requestBrowserNotificationPermission,
  writeBrowserNotificationPreferences,
  type BrowserNotificationPermissionState,
} from "@/lib/browser-notifications";
import { useTheme } from "@/components/theme-provider";

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
        checked ? "bg-tertiary/80" : "bg-outline/20"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ring-1 ring-black/5 ${
          checked ? "translate-x-[18px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-5">
      <h2 className="text-[15px] font-semibold tracking-tight text-on-surface">
        {title}
      </h2>
      {description && (
        <p className="mt-1 text-[13px] text-on-surface-variant/40">
          {description}
        </p>
      )}
    </div>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-3.5">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-on-surface/80">{label}</p>
        {description && (
          <p className="mt-0.5 text-[12px] text-on-surface-variant/35 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function SelectControl({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string; disabled?: boolean }[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="appearance-none rounded-lg bg-surface-container-high/50 border border-outline-variant/10 px-3 py-1.5 pr-8 text-[12px] font-medium text-on-surface/70 outline-none focus:border-secondary/30 transition-colors cursor-pointer"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='%23666'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 8px center",
      }}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} disabled={opt.disabled}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [runtime, setRuntime] = useState("openclaw");
  const [timezone, setTimezone] = useState("auto");
  const [dateFormat, setDateFormat] = useState("relative");
  const [notifyTaskComplete, setNotifyTaskComplete] = useState(
    DEFAULT_BROWSER_NOTIFICATION_PREFERENCES.taskCompleted
  );
  const [notifyErrors, setNotifyErrors] = useState(
    DEFAULT_BROWSER_NOTIFICATION_PREFERENCES.errors
  );
  const [notifyComments, setNotifyComments] = useState(
    DEFAULT_BROWSER_NOTIFICATION_PREFERENCES.comments
  );
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    DEFAULT_BROWSER_NOTIFICATION_PREFERENCES.enabled
  );
  const [notificationPermission, setNotificationPermission] =
    useState<BrowserNotificationPermissionState>("unsupported");
  const [notificationPrefsLoaded, setNotificationPrefsLoaded] = useState(false);
  const [testNotificationState, setTestNotificationState] = useState<
    "idle" | "sent" | "blocked"
  >("idle");
  const [autoRetry, setAutoRetry] = useState(false);
  const [autoResume, setAutoResume] = useState(true);
  const [reviewBeforeClose, setReviewBeforeClose] = useState(true);
  const [markdownComments, setMarkdownComments] = useState(true);

  useEffect(() => {
    setNotificationPermission(readBrowserNotificationPermission());

    if (!isBrowserNotificationSupported()) {
      setNotificationPrefsLoaded(true);
      return;
    }

    const storedPreferences = readBrowserNotificationPreferences();
    setNotificationsEnabled(storedPreferences.enabled);
    setNotifyTaskComplete(storedPreferences.taskCompleted);
    setNotifyErrors(storedPreferences.errors);
    setNotifyComments(storedPreferences.comments);
    setNotificationPrefsLoaded(true);
  }, []);

  useEffect(() => {
    if (!notificationPrefsLoaded) {
      return;
    }

    writeBrowserNotificationPreferences({
      enabled: notificationsEnabled,
      taskCompleted: notifyTaskComplete,
      errors: notifyErrors,
      comments: notifyComments,
    });
  }, [
    notificationPrefsLoaded,
    notificationsEnabled,
    notifyComments,
    notifyErrors,
    notifyTaskComplete,
  ]);

  async function handleEnableBrowserNotifications() {
    if (notificationPermission === "granted") {
      setNotificationsEnabled(true);
      return;
    }

    const nextPermission = await requestBrowserNotificationPermission();
    setNotificationPermission(nextPermission);

    if (nextPermission === "granted") {
      setNotificationsEnabled(true);
    }
  }

  function handleDisableBrowserNotifications() {
    setNotificationsEnabled(false);
    setTestNotificationState("idle");
  }

  function handleSendTestNotification() {
    if (notificationPermission !== "granted" || !notificationsEnabled) {
      setTestNotificationState("blocked");
      return;
    }

    const notification = new Notification("Nova Test Notification", {
      body: "Nova will now alert you for task completions, failures, and agent replies.",
      tag: "nova:test-notification",
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    setTestNotificationState("sent");
  }

  useEffect(() => {
    if (testNotificationState === "idle") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setTestNotificationState("idle");
    }, 5000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [testNotificationState]);

  function renderTestNotificationMessage() {
    if (testNotificationState === "sent") {
      return "Test notification sent. If no system popup appeared, check your browser or macOS notification settings.";
    }

    if (testNotificationState === "blocked") {
      return "Notifications are currently disabled for Nova. Enable them first, then send a test.";
    }

    return null;
  }

  function renderNotificationPermissionLabel() {
    switch (notificationPermission) {
      case "granted":
        return "Allowed";
      case "denied":
        return "Blocked";
      case "default":
        return "Not requested";
      default:
        return "Unsupported";
    }
  }

  return (
    <div className="h-full overflow-y-auto pr-2 scrollbar-thin">
      <div className="mx-auto max-w-2xl pb-16">
        {/* Page Header */}
        <div className="mb-10 anim-1">
          <h1 className="text-2xl font-bold tracking-[-0.03em] text-on-surface">
            Settings
          </h1>
          <p className="mt-1.5 text-[13px] text-on-surface-variant/40">
            Configure how Nova runs agents and displays information.
          </p>
        </div>

        {/* General */}
        <section className="mb-8 anim-2">
          <SectionHeader title="General" />
          <div className="rounded-xl bg-surface-container-low ghost divide-y divide-outline-variant/[0.06] px-5">
            <SettingRow label="Theme" description="Interface color scheme.">
              <SelectControl
                value={theme}
                onChange={(v) => setTheme(v as "dark" | "light")}
                options={[
                  { value: "dark", label: "Dark" },
                  { value: "light", label: "Light" },
                ]}
              />
            </SettingRow>
            <SettingRow
              label="Timezone"
              description="Used for timestamps and scheduling."
            >
              <SelectControl
                value={timezone}
                onChange={setTimezone}
                options={[
                  { value: "auto", label: "Auto-detect" },
                  { value: "utc", label: "UTC" },
                  { value: "est", label: "US Eastern" },
                  { value: "pst", label: "US Pacific" },
                ]}
              />
            </SettingRow>
            <SettingRow
              label="Date format"
              description="How timestamps appear in feeds and logs."
            >
              <SelectControl
                value={dateFormat}
                onChange={setDateFormat}
                options={[
                  { value: "relative", label: "Relative (2m ago)" },
                  { value: "absolute", label: "Absolute (14:32)" },
                  { value: "both", label: "Both" },
                ]}
              />
            </SettingRow>
          </div>
        </section>

        {/* Runtime */}
        <section className="mb-8 anim-3">
          <SectionHeader
            title="Runtime"
            description="The execution provider agents use to run tasks."
          />
          <div className="rounded-xl bg-surface-container-low ghost px-5 divide-y divide-outline-variant/[0.06]">
            <SettingRow
              label="Active runtime"
              description="Select which provider handles agent execution."
            >
              <SelectControl
                value={runtime}
                onChange={setRuntime}
                options={[
                  { value: "openclaw", label: "OpenClaw" },
                  { value: "codex", label: "Codex (coming soon)", disabled: true },
                  { value: "cloud", label: "Cloud Code (coming soon)", disabled: true },
                ]}
              />
            </SettingRow>
            <SettingRow
              label="Auto-retry failed runs"
              description="Automatically retry once when a run fails."
            >
              <Toggle checked={autoRetry} onChange={setAutoRetry} />
            </SettingRow>
            <SettingRow
              label="Auto-resume on reply"
              description="Wake a paused task when an operator comments."
            >
              <Toggle checked={autoResume} onChange={setAutoResume} />
            </SettingRow>
            <SettingRow
              label="Require review before close"
              description="Completed tasks land in review instead of closing."
            >
              <Toggle checked={reviewBeforeClose} onChange={setReviewBeforeClose} />
            </SettingRow>
            <SettingRow
              label="Markdown comments"
              description="Agents write formatted markdown instead of raw logs."
            >
              <Toggle checked={markdownComments} onChange={setMarkdownComments} />
            </SettingRow>
          </div>
        </section>

        {/* Notifications */}
        <section className="mb-8 anim-4">
          <SectionHeader
            title="Notifications"
            description="Desktop alerts for task completions, failures, and comments."
          />
          <div className="rounded-xl bg-surface-container-low ghost divide-y divide-outline-variant/[0.06]">
            {/* Permission banner */}
            {notificationPermission !== "granted" && (
              <div className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary/8">
                    <span className="material-symbols-outlined text-secondary/60" style={{ fontSize: 18 }}>
                      notifications_off
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-on-surface/80">
                      {notificationPermission === "denied"
                        ? "Notifications blocked"
                        : "Enable browser notifications"}
                    </p>
                    <p className="text-[11px] text-on-surface-variant/35">
                      {notificationPermission === "denied"
                        ? "Reset permission in your browser settings to enable alerts."
                        : "Get alerted when tasks finish, fail, or receive comments."}
                    </p>
                  </div>
                </div>
                {notificationPermission === "default" && (
                  <button
                    type="button"
                    onClick={handleEnableBrowserNotifications}
                    className="shrink-0 rounded-lg bg-secondary/10 px-4 py-2 text-[12px] font-semibold text-secondary transition-colors hover:bg-secondary/15"
                  >
                    Enable
                  </button>
                )}
                {notificationPermission === "denied" && (
                  <span className="shrink-0 rounded-md bg-error/8 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-error/60">
                    Blocked
                  </span>
                )}
              </div>
            )}

            {/* Granted: compact confirmation + test + disable */}
            {notificationPermission === "granted" && (
              <div className="px-5 py-3.5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        notificationsEnabled
                          ? "bg-tertiary shadow-[0_0_6px_rgba(209,255,215,0.4)]"
                          : "bg-outline-variant/30"
                      }`}
                    />
                    <p className="text-[12px] font-medium text-on-surface-variant/50">
                      {notificationsEnabled ? "Notifications enabled" : "Notifications disabled"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {notificationsEnabled ? (
                      <>
                        <button
                          type="button"
                          onClick={handleSendTestNotification}
                          className="rounded-md px-2.5 py-1 text-[11px] font-medium text-on-surface-variant/40 transition-colors hover:bg-surface-container-high/50 hover:text-on-surface-variant/60"
                        >
                          Send test
                        </button>
                        <span className="text-outline-variant/20 mx-1">|</span>
                        <button
                          type="button"
                          onClick={handleDisableBrowserNotifications}
                          className="rounded-md px-2.5 py-1 text-[11px] font-medium text-on-surface-variant/30 transition-colors hover:bg-error/[0.06] hover:text-error/70"
                        >
                          Disable
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={handleEnableBrowserNotifications}
                        className="rounded-md px-2.5 py-1 text-[11px] font-medium text-secondary transition-colors hover:bg-secondary/[0.08]"
                      >
                        Enable
                      </button>
                    )}
                  </div>
                </div>
                {renderTestNotificationMessage() && (
                  <p className="mt-2.5 max-w-[640px] text-[11px] leading-relaxed text-on-surface-variant/40">
                    {renderTestNotificationMessage()}
                  </p>
                )}
              </div>
            )}

            {/* Toggle rows */}
            <div className="px-5 divide-y divide-outline-variant/[0.06]">
              <SettingRow
                label="Task completed"
                description="When an agent finishes a task run."
              >
                <Toggle
                  checked={notifyTaskComplete}
                  onChange={setNotifyTaskComplete}
                />
              </SettingRow>
              <SettingRow
                label="Errors"
                description="When a run fails or an agent hits an error."
              >
                <Toggle checked={notifyErrors} onChange={setNotifyErrors} />
              </SettingRow>
              <SettingRow
                label="Comments"
                description="When an agent posts a ticket reply."
              >
                <Toggle checked={notifyComments} onChange={setNotifyComments} />
              </SettingRow>
            </div>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="anim-5">
          <SectionHeader title="Danger zone" />
          <div className="rounded-xl border border-error/10 bg-surface-container-low ghost px-5 divide-y divide-outline-variant/[0.06]">
            <SettingRow
              label="Clear activity log"
              description="Permanently delete all activity feed entries."
            >
              <button className="rounded-lg border border-error/20 px-3.5 py-1.5 text-[12px] font-semibold text-error/70 transition-colors hover:bg-error/[0.06] hover:text-error">
                Clear
              </button>
            </SettingRow>
            <SettingRow
              label="Reset all settings"
              description="Restore every setting on this page to its default value."
            >
              <button className="rounded-lg border border-error/20 px-3.5 py-1.5 text-[12px] font-semibold text-error/70 transition-colors hover:bg-error/[0.06] hover:text-error">
                Reset
              </button>
            </SettingRow>
          </div>
        </section>
      </div>
    </div>
  );
}
