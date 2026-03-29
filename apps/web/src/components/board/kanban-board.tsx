"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import Link from "next/link";
import { SortableTaskCard } from "./sortable-task-card";
import { TaskCard } from "./task-card";
import { Icon } from "@/components/ui/icon";
import type { BoardColumn, BoardTask } from "@/types";

const countBg: Record<BoardColumn["accentColor"], string> = {
  "outline-variant": "bg-surface-container-high text-primary",
  secondary: "bg-surface-container-high text-primary",
  tertiary: "bg-tertiary-container/20 text-tertiary",
  primary: "bg-surface-container-high text-primary",
};

export function KanbanBoard({ initialColumns, projectId }: { initialColumns: BoardColumn[]; projectId: string }) {
  const [columns, setColumns] = useState(initialColumns);
  const [activeTask, setActiveTask] = useState<{ task: BoardTask; accentColor: BoardColumn["accentColor"] } | null>(null);

  function findColumn(taskId: string) {
    return columns.find((col) => col.tasks.some((t) => t.id === taskId));
  }

  function findColumnById(columnId: string) {
    return columns.find((c) => c.id === columnId);
  }

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    const col = findColumn(active.id as string);
    if (col) {
      const task = col.tasks.find((t) => t.id === active.id);
      if (task) {
        setActiveTask({ task, accentColor: col.accentColor });
      }
    }
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const sourceCol = findColumn(activeId);
    if (!sourceCol) return;

    // Check if hovering over a column droppable (empty column case)
    // or over a task in a different column
    const isOverColumn = !!findColumnById(overId);
    const destCol = isOverColumn
      ? findColumnById(overId)
      : findColumn(overId);

    if (!destCol || sourceCol.id === destCol.id) return;

    const task = sourceCol.tasks.find((t) => t.id === activeId);
    if (!task) return;

    setColumns((prev) =>
      prev.map((col) => {
        if (col.id === sourceCol.id) {
          return {
            ...col,
            tasks: col.tasks.filter((t) => t.id !== activeId),
            count: col.count - 1,
          };
        }
        if (col.id === destCol.id) {
          // If dropping onto a column (empty), append to end
          // If dropping onto a task, insert at that position
          const overIndex = col.tasks.findIndex((t) => t.id === overId);
          const insertIndex = overIndex >= 0 ? overIndex : col.tasks.length;
          const newTasks = [...col.tasks];
          newTasks.splice(insertIndex, 0, task);
          return { ...col, tasks: newTasks, count: col.count + 1 };
        }
        return col;
      })
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    // Handle drop onto empty column
    if (findColumnById(overId)) return;

    const col = findColumn(activeId);
    if (!col) return;

    // Reorder within same column
    const oldIndex = col.tasks.findIndex((t) => t.id === activeId);
    const newIndex = col.tasks.findIndex((t) => t.id === overId);

    if (oldIndex >= 0 && newIndex >= 0) {
      setColumns((prev) =>
        prev.map((c) => {
          if (c.id !== col.id) return c;
          const newTasks = [...c.tasks];
          const [moved] = newTasks.splice(oldIndex, 1);
          newTasks.splice(newIndex, 0, moved);
          return { ...c, tasks: newTasks };
        })
      );
    }
  }

  return (
    <DndContext
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full p-6 gap-6 min-w-max">
        {columns.map((column) => (
          <DroppableColumn key={column.id} column={column} projectId={projectId} />
        ))}
      </div>

      <DragOverlay>
        {activeTask && (
          <div className="opacity-90 rotate-[2deg] scale-105">
            <TaskCard
              task={activeTask.task}
              accentColor={activeTask.accentColor}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function DroppableColumn({ column, projectId }: { column: BoardColumn; projectId: string }) {
  const taskIds = column.tasks.map((t) => t.id);

  // useDroppable makes the column itself a drop target even when empty
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  return (
    <SortableContext items={taskIds} strategy={verticalListSortingStrategy} id={column.id}>
      <section
        className={`min-w-[320px] max-w-[320px] flex flex-col gap-4 ${column.dimmed ? "opacity-70 hover:opacity-100 transition-opacity" : ""}`}
      >
        {/* Column Header */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              {column.title}
            </span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${countBg[column.accentColor]}`}
            >
              {String(column.count).padStart(2, "0")}
            </span>
          </div>
          {column.id === "backlog" && (
            <Link href="/tasks/new" className="text-on-surface-variant hover:text-on-surface transition-colors">
              <Icon name="add" size={16} />
            </Link>
          )}
        </div>

        {/* Task Cards — ref on this container makes empty columns droppable */}
        <div
          ref={setNodeRef}
          className={`flex-1 flex flex-col gap-3 overflow-y-auto scrollbar-thin pr-2 min-h-[100px] rounded-sm transition-colors ${isOver ? "bg-surface-container-high/30" : ""}`}
        >
          {column.tasks.map((task) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              accentColor={column.accentColor}
              isDone={column.dimmed}
              columnId={column.id}
              projectId={projectId}
            />
          ))}
        </div>
      </section>
    </SortableContext>
  );
}
