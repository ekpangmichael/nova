"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import type { BoardTask, BoardColumn } from "@/types";

const borderMap: Record<BoardColumn["accentColor"], string> = {
  "outline-variant": "border-outline-variant/30",
  secondary: "border-secondary",
  tertiary: "border-tertiary",
  primary: "border-primary",
};

export function TaskCard({
  task,
  accentColor,
  isDone,
  projectId,
}: {
  task: BoardTask;
  accentColor: BoardColumn["accentColor"];
  isDone?: boolean;
  projectId?: string;
}) {
  const router = useRouter();
  const pointerStart = useRef<{ x: number; y: number; time: number } | null>(null);
  const href = projectId ? `/projects/${projectId}/board/${task.id}` : null;

  function handlePointerDown(e: React.PointerEvent) {
    pointerStart.current = { x: e.clientX, y: e.clientY, time: Date.now() };
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (!href || !pointerStart.current) return;

    const dx = Math.abs(e.clientX - pointerStart.current.x);
    const dy = Math.abs(e.clientY - pointerStart.current.y);
    const elapsed = Date.now() - pointerStart.current.time;

    // Only navigate if it was a tap (small movement, short duration)
    if (dx < 5 && dy < 5 && elapsed < 300) {
      router.push(href);
    }

    pointerStart.current = null;
  }

  if (isDone) {
    return (
      <div
        className={`bg-surface-container p-4 rounded-sm border-l-2 border-outline-variant/30 grayscale ${href ? "cursor-pointer hover:bg-surface-container-high transition-all" : ""}`}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        <div className="flex justify-between items-start mb-2">
          <span className="text-[10px] font-mono text-outline tracking-tighter line-through">
            {task.displayId ?? task.id}
          </span>
          <Icon name="check_circle" size={14} filled className="text-tertiary" />
        </div>
        <h4 className={`text-sm font-medium leading-snug ${href ? "text-on-surface-variant/60 group-hover:text-secondary transition-colors" : "text-on-surface-variant/60"}`}>
          {task.title}
        </h4>
      </div>
    );
  }

  const isInProgress = accentColor === "tertiary";

  return (
    <div
      className={`group ${isInProgress ? "bg-surface-container-lowest ghost" : "bg-surface-container"} p-4 rounded-sm border-l-2 ${borderMap[accentColor]} hover:bg-surface-container-high transition-all cursor-pointer`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      {/* Task ID + drag handle */}
      <div className="flex justify-between items-start mb-2">
        <span
          className={`text-[10px] font-mono tracking-tighter ${isInProgress ? "text-tertiary" : "text-secondary-dim"}`}
        >
          {task.displayId ?? task.id}
        </span>
        {accentColor === "outline-variant" && (
          <Icon
            name="drag_indicator"
            size={14}
            className="text-on-surface-variant opacity-0 group-hover:opacity-100 group-hover:text-secondary-dim transition-all"
          />
        )}
      </div>

      {/* Title */}
      <h4 className="text-sm font-medium text-on-surface leading-snug mb-3 group-hover:text-secondary transition-colors">
        {task.title}
      </h4>

      {/* Progress bar (In Progress cards) */}
      {task.progress != null && (
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[9px] font-mono text-tertiary uppercase">
              {task.progressLabel}
            </span>
            <span className="text-[9px] font-mono text-on-surface-variant">
              {task.progress}%
            </span>
          </div>
          <div className="h-1 w-full bg-surface-container rounded-full overflow-hidden">
            <div
              className="h-full bg-tertiary shadow-[0_0_8px_rgba(209,255,215,0.4)]"
              style={{ width: `${task.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer: priority, agent, metadata */}
      <div className="flex items-center justify-between">
        {/* Left side */}
        <div className="flex items-center gap-2">
          {task.assignedAgent && (
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-tertiary-container/30 flex items-center justify-center">
                <Icon name="smart_toy" size={12} filled className="text-on-tertiary" />
              </div>
              {isInProgress && (
                <span className="text-[10px] font-mono text-on-surface-variant">
                  {task.assignedAgent}
                </span>
              )}
            </div>
          )}
          {task.comments != null && (
            <div className="flex items-center gap-1">
              <Icon name="chat_bubble" size={14} className="text-on-surface-variant" />
              <span className="text-[10px] font-mono text-on-surface-variant">{task.comments}</span>
            </div>
          )}
          {task.attachments != null && (
            <div className="flex items-center gap-1">
              <Icon name="attach_file" size={14} className="text-on-surface-variant" />
              <span className="text-[10px] font-mono text-on-surface-variant">{task.attachments}</span>
            </div>
          )}
        </div>

        {/* Right side */}
        {task.priority === "urgent" && (
          <div className="flex items-center gap-1">
            <Icon name="priority_high" size={14} className="text-error" />
            <span className="text-[9px] font-mono text-error uppercase">Urgent</span>
          </div>
        )}
        {task.priority === "low" && (
          <span className="px-2 py-0.5 rounded-full bg-surface-container-lowest text-[9px] font-mono text-outline uppercase tracking-tighter">
            Low Priority
          </span>
        )}
        {task.date && (
          <span className="text-[10px] font-mono text-on-surface-variant/60">
            {task.date}
          </span>
        )}
      </div>
    </div>
  );
}
