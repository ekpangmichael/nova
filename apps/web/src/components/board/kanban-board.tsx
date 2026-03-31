"use client";

import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SortableTaskCard } from "./sortable-task-card";
import { TaskCard } from "./task-card";
import { Icon } from "@/components/ui/icon";
import { ApiError, patchTask } from "@/lib/api";
import type { BoardColumn, BoardTask } from "@/types";

const countBg: Record<BoardColumn["accentColor"], string> = {
  "outline-variant": "bg-surface-container-high text-primary",
  secondary: "bg-surface-container-high text-primary",
  tertiary: "bg-tertiary-container/20 text-tertiary",
  primary: "bg-surface-container-high text-primary",
};

type BackendTaskStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "in_review"
  | "done"
  | "failed"
  | "blocked"
  | "paused"
  | "canceled";

export function KanbanBoard({
  initialColumns,
  projectId,
}: {
  initialColumns: BoardColumn[];
  projectId: string;
}) {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [columns, setColumns] = useState(initialColumns);
  const [activeTask, setActiveTask] = useState<{
    task: BoardTask;
    accentColor: BoardColumn["accentColor"];
    sourceColumnId: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const columnsRef = useRef(initialColumns);
  const dragSnapshotRef = useRef<BoardColumn[] | null>(null);
  const dragSourceColumnIdRef = useRef<string | null>(null);
  const dragDestinationColumnIdRef = useRef<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    columnsRef.current = initialColumns;
    setColumns(initialColumns);
  }, [initialColumns]);

  function findColumn(taskId: string) {
    return columnsRef.current.find((column) =>
      column.tasks.some((task) => task.id === taskId)
    );
  }

  function findColumnById(columnId: string) {
    return columnsRef.current.find((column) => column.id === columnId);
  }

  function applyColumnsUpdate(updater: (previousColumns: BoardColumn[]) => BoardColumn[]) {
    setColumns((previousColumns) => {
      const nextColumns = updater(previousColumns);
      columnsRef.current = nextColumns;
      return nextColumns;
    });
  }

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    const sourceColumn = findColumn(active.id as string);

    if (!sourceColumn) {
      return;
    }

    const task = sourceColumn.tasks.find((entry) => entry.id === active.id);

    if (!task) {
      return;
    }

    dragSnapshotRef.current = columnsRef.current.map((column) => ({
      ...column,
      tasks: [...column.tasks],
    }));
    dragSourceColumnIdRef.current = sourceColumn.id;
    dragDestinationColumnIdRef.current = sourceColumn.id;
    setErrorMessage(null);
    const nextActiveTask = {
      task,
      accentColor: sourceColumn.accentColor,
      sourceColumnId: sourceColumn.id,
    };
    setActiveTask(nextActiveTask);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;

    if (!over) {
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;
    const sourceColumn = findColumn(activeId);

    if (!sourceColumn) {
      return;
    }

    const isOverColumn = !!findColumnById(overId);
    const destinationColumn = isOverColumn
      ? findColumnById(overId)
      : findColumn(overId);

    if (!destinationColumn || sourceColumn.id === destinationColumn.id) {
      return;
    }

    dragDestinationColumnIdRef.current = destinationColumn.id;

    const task = sourceColumn.tasks.find((entry) => entry.id === activeId);

    if (!task) {
      return;
    }

    applyColumnsUpdate((previousColumns) =>
      previousColumns.map((column) => {
        if (column.id === sourceColumn.id) {
          return {
            ...column,
            tasks: column.tasks.filter((entry) => entry.id !== activeId),
            count: column.count - 1,
          };
        }

        if (column.id === destinationColumn.id) {
          const overIndex = column.tasks.findIndex((entry) => entry.id === overId);
          const insertIndex = overIndex >= 0 ? overIndex : column.tasks.length;
          const nextTasks = [...column.tasks];
          nextTasks.splice(insertIndex, 0, task);
          return {
            ...column,
            tasks: nextTasks,
            count: column.count + 1,
          };
        }

        return column;
      })
    );
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) {
      if (dragSnapshotRef.current) {
        columnsRef.current = dragSnapshotRef.current;
        setColumns(dragSnapshotRef.current);
      }
      dragSnapshotRef.current = null;
      dragSourceColumnIdRef.current = null;
      dragDestinationColumnIdRef.current = null;
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;
    const sourceColumnId =
      dragSourceColumnIdRef.current ??
      (typeof active.data.current?.sortable?.containerId === "string"
        ? active.data.current.sortable.containerId
        : dragSnapshotRef.current?.find((column) =>
              column.tasks.some((task) => task.id === activeId)
            )?.id ?? null);
    const currentColumnId =
      columnsRef.current.find((column) =>
        column.tasks.some((task) => task.id === activeId)
      )?.id ??
      dragDestinationColumnIdRef.current;

    if (!currentColumnId) {
      if (dragSnapshotRef.current) {
        columnsRef.current = dragSnapshotRef.current;
        setColumns(dragSnapshotRef.current);
      }
      dragSnapshotRef.current = null;
      dragSourceColumnIdRef.current = null;
      dragDestinationColumnIdRef.current = null;
      return;
    }

    if (sourceColumnId && sourceColumnId !== currentColumnId) {
      try {
        await patchTask(activeId, {
          status: currentColumnId as BackendTaskStatus,
        });
        router.refresh();
      } catch (error) {
        if (dragSnapshotRef.current) {
          columnsRef.current = dragSnapshotRef.current;
          setColumns(dragSnapshotRef.current);
        }
        setErrorMessage(
          error instanceof ApiError
            ? error.message
            : "Unable to update the task status."
        );
      } finally {
        dragSnapshotRef.current = null;
        dragSourceColumnIdRef.current = null;
        dragDestinationColumnIdRef.current = null;
      }
      return;
    }

    if (activeId === overId) {
      dragSnapshotRef.current = null;
      dragSourceColumnIdRef.current = null;
      dragDestinationColumnIdRef.current = null;
      return;
    }

    const column = findColumn(activeId);

    if (!column) {
      dragSnapshotRef.current = null;
      return;
    }

    const oldIndex = column.tasks.findIndex((task) => task.id === activeId);
    const newIndex = column.tasks.findIndex((task) => task.id === overId);

    if (oldIndex >= 0 && newIndex >= 0) {
      applyColumnsUpdate((previousColumns) =>
        previousColumns.map((entry) => {
          if (entry.id !== column.id) {
            return entry;
          }

          const nextTasks = [...entry.tasks];
          const [moved] = nextTasks.splice(oldIndex, 1);
          nextTasks.splice(newIndex, 0, moved);
          return {
            ...entry,
            tasks: nextTasks,
          };
        })
      );
    }

    dragSnapshotRef.current = null;
    dragSourceColumnIdRef.current = null;
    dragDestinationColumnIdRef.current = null;
  }

  if (!isMounted) {
    return (
      <>
        {errorMessage ? (
          <div className="px-6 pt-4">
            <div className="rounded-sm border border-error/30 bg-error/8 px-4 py-3 text-sm text-error">
              {errorMessage}
            </div>
          </div>
        ) : null}

        <div className="flex min-w-max items-start gap-2 p-6 pb-24">
          {columns.map((column) => (
            <StaticColumn key={column.id} column={column} projectId={projectId} />
          ))}
        </div>
      </>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      {errorMessage ? (
        <div className="px-6 pt-4">
          <div className="rounded-sm border border-error/30 bg-error/8 px-4 py-3 text-sm text-error">
            {errorMessage}
          </div>
        </div>
      ) : null}

      <div className="flex min-w-max items-start gap-2 p-6 pb-24">
        {columns.map((column) => (
          <DroppableColumn key={column.id} column={column} projectId={projectId} />
        ))}
      </div>

      <DragOverlay>
        {activeTask ? (
          <div className="rotate-[2deg] scale-105 opacity-90">
            <TaskCard task={activeTask.task} accentColor={activeTask.accentColor} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function ColumnHeader({
  column,
  projectId,
}: {
  column: BoardColumn;
  projectId: string;
}) {
  return (
    <div className="flex items-center justify-between px-1">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
          {column.title}
        </span>
        <span
          className={`rounded-full px-1.5 py-0.5 text-[10px] font-mono ${countBg[column.accentColor]}`}
        >
          {String(column.count).padStart(2, "0")}
        </span>
      </div>
      {column.id === "backlog" ? (
        <Link
          href={`/tasks/new?projectId=${projectId}`}
          className="text-on-surface-variant transition-colors hover:text-on-surface"
        >
          <Icon name="add" size={16} />
        </Link>
      ) : null}
    </div>
  );
}

function StaticColumn({
  column,
  projectId,
}: {
  column: BoardColumn;
  projectId: string;
}) {
  return (
    <section
      className={`flex min-w-[248px] max-w-[248px] self-start flex-col gap-4 ${
        column.dimmed ? "opacity-70 transition-opacity hover:opacity-100" : ""
      }`}
    >
      <ColumnHeader column={column} projectId={projectId} />

      <div className="scrollbar-thin flex min-h-[100px] flex-col gap-3 rounded-sm pr-2">
        {column.tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            accentColor={column.accentColor}
            isDone={column.dimmed}
            projectId={projectId}
          />
        ))}
      </div>
    </section>
  );
}

function DroppableColumn({
  column,
  projectId,
}: {
  column: BoardColumn;
  projectId: string;
}) {
  const taskIds = column.tasks.map((task) => task.id);
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  return (
    <SortableContext
      items={taskIds}
      strategy={verticalListSortingStrategy}
      id={column.id}
    >
      <section
        className={`flex min-w-[248px] max-w-[248px] self-start flex-col gap-4 ${
          column.dimmed ? "opacity-70 transition-opacity hover:opacity-100" : ""
        }`}
      >
        <ColumnHeader column={column} projectId={projectId} />

        <div
          ref={setNodeRef}
          className={`scrollbar-thin flex min-h-[100px] flex-col gap-3 rounded-sm pr-2 transition-colors ${
            isOver ? "bg-surface-container-high/30" : ""
          }`}
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
