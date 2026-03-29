import { notFound } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { TaskHeader } from "@/components/task-detail/task-header";
import { TaskDescription } from "@/components/task-detail/task-description";
import { TaskAttachments } from "@/components/task-detail/task-attachments";
import { TaskMetadata } from "@/components/task-detail/task-metadata";
import { TaskExecutionLog } from "@/components/task-detail/task-execution-log";
import { CommentThread } from "@/components/task-detail/comment-thread";
import { taskDetails, projectDetails } from "@/lib/mock-data";

export function generateStaticParams() {
  const params: { id: string; taskId: string }[] = [];
  for (const projectId of Object.keys(projectDetails)) {
    for (const taskId of Object.keys(taskDetails)) {
      params.push({ id: projectId, taskId });
    }
  }
  return params;
}

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string; taskId: string }>;
}) {
  const { id, taskId } = await params;
  const task = taskDetails[taskId];
  const project = projectDetails[id];

  if (!task || !project) {
    notFound();
  }

  return (
    <>
      {/* Sub-nav header */}
      <div className="flex justify-between items-center mb-10 anim-1">
        <div className="flex items-center gap-6">
          <Link
            href={`/projects/${id}/board`}
            className="text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-1 text-sm"
          >
            <Icon name="arrow_back" size={16} />
            Board
          </Link>
          <div className="h-4 w-px bg-outline-variant/30" />
          <span className="text-on-surface font-semibold text-sm ghost-b border-secondary pb-1">
            Task Detail
          </span>
          <span className="text-on-surface-variant/40 text-sm hover:text-on-surface-variant transition-colors cursor-pointer">
            Files
          </span>
          <span className="text-on-surface-variant/40 text-sm hover:text-on-surface-variant transition-colors cursor-pointer">
            Comments
          </span>
        </div>
        <button className="flex items-center gap-2 px-4 py-1.5 rounded-sm bg-secondary-container text-on-surface text-sm font-medium hover:opacity-80 transition-all active:scale-95">
          <Icon name="play_arrow" size={18} filled />
          Start Task
        </button>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-16">
        {/* Left: Primary content (8 cols) */}
        <section className="md:col-span-8 space-y-12 anim-2">
          <TaskHeader task={task} />
          <TaskDescription paragraphs={task.description} />
          <TaskAttachments attachments={task.attachments} />
          <CommentThread />
        </section>

        {/* Right: Metadata sidebar (4 cols) */}
        <aside className="md:col-span-4 space-y-10 anim-3">
          <TaskMetadata task={task} />
          <TaskExecutionLog log={task.executionLog} />

          {/* Secondary Actions */}
          <div className="flex flex-col gap-3 pt-4">
            <button className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-sm ghost text-xs font-medium text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all">
              <Icon name="share" size={16} />
              Share Context
            </button>
            <button className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-sm ghost text-xs font-medium text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all">
              <Icon name="archive" size={16} />
              Archive Task
            </button>
          </div>
        </aside>
      </div>
    </>
  );
}
