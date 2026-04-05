"use client";

import { useEffect, useRef, useState } from "react";
import type { ApiTaskComment, ApiTaskDetail, ApiTaskRun } from "@/lib/api";
import { resolveBackendWebsocketUrl } from "@/lib/api";
import {
  DEFAULT_BROWSER_NOTIFICATION_PREFERENCES,
  readBrowserNotificationPermission,
  readBrowserNotificationPreferences,
  subscribeToBrowserNotificationPreferences,
  type BrowserNotificationPermissionState,
  type BrowserNotificationPreferences,
} from "@/lib/browser-notifications";

type WebsocketEnvelope = {
  type: string;
  payload: unknown;
  sentAt: string;
};

type RunNotificationPayload = ApiTaskRun & {
  task?: {
    id?: string;
    title?: string;
    projectId?: string;
  };
  agent?: {
    name?: string;
  };
};

type TaskNotificationPayload = ApiTaskDetail;

function shouldShowNotification(
  run: RunNotificationPayload,
  preferences: BrowserNotificationPreferences
) {
  if (run.status === "completed") {
    return preferences.taskCompleted;
  }

  if (run.status === "failed") {
    return preferences.errors;
  }

  return false;
}

function buildNotificationCopy(run: RunNotificationPayload) {
  const taskTitle = run.task?.title?.trim() || "Task";
  const agentName = run.agent?.name?.trim() || "Assigned agent";

  if (run.status === "completed") {
    return {
      title: "Task Ready For Review",
      body: `${taskTitle} completed successfully with ${agentName}.`,
    };
  }

  return {
    title: "Task Run Failed",
    body: run.failureReason
      ? `${taskTitle} failed: ${run.failureReason}`
      : `${taskTitle} failed. Open Nova for the latest error details.`,
  };
}

function buildCommentNotificationCopy(task: TaskNotificationPayload, comment: ApiTaskComment) {
  const taskTitle = task.title?.trim() || "Task";
  const authorLabel = comment.authorLabel?.trim() || "Nova";

  return {
    title: `${authorLabel} replied on ${taskTitle}`,
    body: comment.body.trim().slice(0, 160) || "Open Nova for the latest comment.",
  };
}

export function BrowserNotificationManager() {
  const [permission, setPermission] = useState<BrowserNotificationPermissionState>("unsupported");
  const [preferences, setPreferences] = useState<BrowserNotificationPreferences>(
    DEFAULT_BROWSER_NOTIFICATION_PREFERENCES
  );
  const notifiedStatusesRef = useRef<Set<string>>(new Set());
  const seenCommentIdsRef = useRef<Set<string>>(new Set());
  const mountedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    setPreferences(readBrowserNotificationPreferences());
    setPermission(readBrowserNotificationPermission());

    const unsubscribe = subscribeToBrowserNotificationPreferences((nextPreferences) => {
      setPreferences(nextPreferences);
    });

    const syncPermission = () => {
      setPermission(readBrowserNotificationPermission());
    };

    window.addEventListener("focus", syncPermission);
    document.addEventListener("visibilitychange", syncPermission);

    return () => {
      unsubscribe();
      window.removeEventListener("focus", syncPermission);
      document.removeEventListener("visibilitychange", syncPermission);
    };
  }, []);

  useEffect(() => {
    if (permission !== "granted") {
      return;
    }

    if (
      !preferences.enabled ||
      (!preferences.taskCompleted && !preferences.errors && !preferences.comments)
    ) {
      return;
    }

    const socket = new WebSocket(resolveBackendWebsocketUrl());

    socket.onmessage = (rawEvent) => {
      let envelope: WebsocketEnvelope;

      try {
        envelope = JSON.parse(rawEvent.data as string) as WebsocketEnvelope;
      } catch {
        return;
      }

      if (envelope.type === "task.updated" && preferences.comments) {
        const task = envelope.payload as TaskNotificationPayload;

        if (!task?.id || !task.project?.id || !Array.isArray(task.comments)) {
          return;
        }

        for (const comment of task.comments) {
          if (!comment?.id || seenCommentIdsRef.current.has(comment.id)) {
            continue;
          }

          seenCommentIdsRef.current.add(comment.id);

          if (comment.authorType !== "agent") {
            continue;
          }

          const createdAt = Date.parse(comment.createdAt);

          if (Number.isNaN(createdAt) || createdAt < mountedAtRef.current - 1000) {
            continue;
          }

          const { title, body } = buildCommentNotificationCopy(task, comment);
          const notification = new Notification(title, {
            body,
            tag: `comment:${comment.id}`,
          });

          notification.onclick = () => {
            window.focus();
            window.location.assign(`/projects/${task.project.id}/board/${task.id}`);
            notification.close();
          };
        }

        return;
      }

      if (envelope.type !== "run.updated") {
        return;
      }

      const run = envelope.payload as RunNotificationPayload;

      if (!run?.id || !run.task?.id || !run.task.projectId) {
        return;
      }

      if (!shouldShowNotification(run, preferences)) {
        return;
      }

      const notificationKey = `${run.id}:${run.status}`;

      if (notifiedStatusesRef.current.has(notificationKey)) {
        return;
      }

      notifiedStatusesRef.current.add(notificationKey);

      try {
        const { title, body } = buildNotificationCopy(run);
        const notification = new Notification(title, {
          body,
          tag: notificationKey,
        });

        notification.onclick = () => {
          window.focus();
          window.location.assign(
            `/projects/${run.task?.projectId}/board/${run.task?.id}`
          );
          notification.close();
        };
      } catch {
        notifiedStatusesRef.current.delete(notificationKey);
      }
    };

    return () => {
      socket.close();
    };
  }, [
    permission,
    preferences.comments,
    preferences.enabled,
    preferences.errors,
    preferences.taskCompleted,
  ]);

  return null;
}
