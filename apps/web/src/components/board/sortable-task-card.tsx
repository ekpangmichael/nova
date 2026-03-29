"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TaskCard } from "./task-card";
import type { BoardTask, BoardColumn } from "@/types";

export function SortableTaskCard({
  task,
  accentColor,
  isDone,
  columnId,
  projectId,
}: {
  task: BoardTask;
  accentColor: BoardColumn["accentColor"];
  isDone?: boolean;
  columnId: string;
  projectId?: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { columnId },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={isDragging ? "opacity-30" : ""}
    >
      <TaskCard task={task} accentColor={accentColor} isDone={isDone} projectId={projectId} />
    </div>
  );
}
