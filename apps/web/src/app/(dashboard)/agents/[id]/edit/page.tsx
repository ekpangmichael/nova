import { notFound } from "next/navigation";
import { ApiError, getAgent } from "@/lib/api";
import { EditAgentForm } from "./edit-agent-form";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function loadAgent(id: string) {
  if (!UUID_PATTERN.test(id)) {
    notFound();
  }

  try {
    return await getAgent(id);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) {
      notFound();
    }

    throw error;
  }
}

export default async function EditAgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agent = await loadAgent(id);

  return <EditAgentForm agent={agent} />;
}
