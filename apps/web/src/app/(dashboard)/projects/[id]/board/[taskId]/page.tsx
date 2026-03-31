import { notFound } from "next/navigation";
import { TaskDetailScreen } from "@/components/task-detail/task-detail-screen";
import {
  ApiError,
  getRunEvents,
  getTask,
} from "@/lib/api";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string; taskId: string }>;
}) {
  const { id, taskId } = await params;

  try {
    const task = await getTask(taskId);

    if (task.project.id !== id) {
      notFound();
    }

    const runEvents = task.currentRun ? await getRunEvents(task.currentRun.id) : [];

    return (
      <TaskDetailScreen
        projectId={id}
        initialTask={task}
        initialRunEvents={runEvents}
      />
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }

    throw error;
  }
}
