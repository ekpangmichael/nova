"use client";

import dynamic from "next/dynamic";
import type { BoardColumn } from "@/types";

const KanbanBoard = dynamic(
  () => import("./kanban-board").then((module) => module.KanbanBoard),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-start gap-2 overflow-x-auto scrollbar-thin pb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex w-[220px] shrink-0 animate-pulse flex-col gap-4">
            <div className="h-6 w-28 rounded-sm bg-surface-container-high" />
            <div className="min-h-[120px] rounded-sm bg-surface-container-low" />
          </div>
        ))}
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
