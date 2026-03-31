import { notFound } from "next/navigation";
import { ApiError, getProject } from "@/lib/api";
import { EditProjectForm } from "./edit-project-form";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    const project = await getProject(id);

    return <EditProjectForm project={project} />;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }

    throw error;
  }
}
