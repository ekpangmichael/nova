"use client";

import dynamic from "next/dynamic";
import type { BoardColumn } from "@/types";

const KanbanBoard = dynamic(
  () => import("./kanban-board").then((module) => module.KanbanBoard),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-w-max items-start gap-2 p-6 pb-24">
        <div className="flex min-w-[248px] max-w-[248px] animate-pulse flex-col gap-4">
          <div className="h-6 w-28 rounded-sm bg-surface-container-high" />
          <div className="min-h-[120px] rounded-sm bg-surface-container-low" />
        </div>
      </div>
    ),
  }
);

export function KanbanBoardShell({
  initialColumns,
  projectId,
}: {
  initialColumns: BoardColumn[];
  projectId: string;
}) {
  return <KanbanBoard initialColumns={initialColumns} projectId={projectId} />;
}
