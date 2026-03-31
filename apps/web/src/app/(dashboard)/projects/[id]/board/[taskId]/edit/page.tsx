import { notFound } from "next/navigation";
import { ApiError, getTask } from "@/lib/api";
import { EditTaskForm } from "./edit-task-form";

export default async function EditTaskPage({
  params,
}: {
  params: Promise<{ id: string; taskId: string }>;
}) {
  const { id: projectId, taskId } = await params;

  try {
    const task = await getTask(taskId);

    if (task.project.id !== projectId) {
      notFound();
    }

    return <EditTaskForm task={task} projectId={projectId} />;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) {
      notFound();
    }

    throw error;
  }
}
