"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import {
  ApiError,
  type ApiAgent,
  type ApiTaskDetail,
  assignAgentToProject,
  getAgents,
  patchTask,
  selectExecutionTargetDirectory,
} from "@/lib/api";

const priorities = [
  { label: "Low", value: "low" as const },
  { label: "Medium", value: "medium" as const },
  { label: "High", value: "high" as const },
  { label: "Urgent", value: "critical" as const },
];

const statuses = [
  { label: "Backlog", value: "backlog" as const },
  { label: "Todo", value: "todo" as const },
  { label: "In Progress", value: "in_progress" as const },
  { label: "In Review", value: "in_review" as const },
  { label: "Done", value: "done" as const },
  { label: "Blocked", value: "blocked" as const },
  { label: "Paused", value: "paused" as const },
  { label: "Failed", value: "failed" as const },
  { label: "Canceled", value: "canceled" as const },
];

function formatDueDate(dueAt: string | null) {
  if (!dueAt) return "";
  try {
    return new Date(dueAt).toISOString().split("T")[0];
  } catch {
    return "";
  }
}

export function EditTaskForm({
  task,
  projectId,
}: {
  task: ApiTaskDetail;
  projectId: string;
}) {
  const router = useRouter();
  const [agents, setAgents] = useState<ApiAgent[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [status, setStatus] = useState(task.status);
  const [priority, setPriority] = useState(task.priority);
  const [assignedAgentId, setAssignedAgentId] = useState(task.assignedAgentId);
  const [handoffAgentId, setHandoffAgentId] = useState(task.handoffAgentId ?? "");
  const [executionTargetOverride, setExecutionTargetOverride] = useState(
    task.executionTargetOverride ?? ""
  );
  const [useGitWorktree, setUseGitWorktree] = useState(task.useGitWorktree);
  const [dueAt, setDueAt] = useState(formatDueDate(task.dueAt));
  const [labels, setLabels] = useState(task.labels.join(", "));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPickingDirectory, setIsPickingDirectory] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      setIsLoadingOptions(true);

      try {
        const nextAgents = await getAgents();

        if (cancelled) return;

        setAgents(nextAgents);
      } catch (error) {
        if (cancelled) return;

        setErrorMessage(
          error instanceof ApiError
            ? error.message
            : "Unable to load projects and agents."
        );
      } finally {
        if (!cancelled) setIsLoadingOptions(false);
      }
    }

    void loadOptions();

    return () => {
      cancelled = true;
    };
  }, []);

  const assignedAgents = agents.filter((agent) =>
    agent.projectIds.includes(task.projectId)
  );
  const unassignedAgents = agents.filter(
    (agent) => !agent.projectIds.includes(task.projectId)
  );
  const selectedAgent = agents.find((agent) => agent.id === assignedAgentId) ?? null;
  const displayedExecutionTarget =
    executionTargetOverride || task.project.projectRoot;

  async function handleBrowseExecutionTarget() {
    setErrorMessage(null);
    setIsPickingDirectory(true);

    try {
      const selection = await selectExecutionTargetDirectory();

      if (selection.path) {
        setExecutionTargetOverride(selection.path);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "Unable to open the directory picker. Try again."
      );
    } finally {
      setIsPickingDirectory(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (!title.trim()) {
      setErrorMessage("Task title is required.");
      return;
    }

    if (!assignedAgentId) {
      setErrorMessage("Select an agent.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (selectedAgent && !selectedAgent.projectIds.includes(task.projectId)) {
        await assignAgentToProject(task.projectId, selectedAgent.id);
      }

      await patchTask(task.id, {
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
        assignedAgentId,
        handoffAgentId: handoffAgentId || null,
        executionTargetOverride: executionTargetOverride.trim() || null,
        useGitWorktree,
        dueAt: dueAt || null,
        labels: labels
          .split(",")
          .map((label) => label.trim())
          .filter(Boolean),
      });

      router.push(`/projects/${projectId}/board/${task.id}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError ? error.message : "Unable to save the task."
      );
      setIsSubmitting(false);
    }
  }

  const taskDisplayId = `TASK-${String(task.taskNumber).padStart(3, "0")}`;

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href={`/projects/${projectId}/board/${task.id}`}
        className="mb-6 flex items-center gap-1.5 text-sm text-on-surface-variant transition-colors hover:text-on-surface"
      >
        <Icon name="arrow_back" size={16} />
        {taskDisplayId}
      </Link>

      <div className="mb-4 flex items-center gap-2 text-outline">
        <span className="text-xs font-mono uppercase tracking-widest">
          {task.id}
        </span>
      </div>

      <header className="mb-16">
        <h1 className="text-4xl font-light leading-tight tracking-tight text-on-surface">
          Edit Task
        </h1>
        <p className="mt-4 max-w-xl font-light leading-relaxed text-on-surface-variant">
          Update the objective, execution parameters, and context for this task.
          Changes will be reflected on the next agent synchronization.
        </p>
      </header>

      {errorMessage ? (
        <div className="mb-8 rounded-sm border border-error/30 bg-error/8 px-4 py-3 text-sm text-error">
          {errorMessage}
        </div>
      ) : null}

      <form className="space-y-24" onSubmit={handleSubmit}>
        {/* 01 Task Definition */}
        <section className="space-y-8">
          <div className="flex items-baseline gap-4 ghost-b pb-2">
            <span className="font-mono text-xs text-secondary">01</span>
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-on-surface-variant">
              Task Definition
            </h2>
          </div>
          <div className="space-y-12">
            <div className="grid gap-8 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-[10px] uppercase tracking-widest text-outline">
                  Project
                </label>
                <div className="bg-surface-container-low px-4 py-3 ghost">
                  <p className="text-sm text-on-surface">
                    {task.project.name}
                  </p>
                  <p className="font-mono text-[11px] text-on-surface-variant/50 mt-1">
                    {task.projectId}
                  </p>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[10px] uppercase tracking-widest text-outline">
                  Objective Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="w-full border-none border-b pb-4 text-2xl font-light text-on-surface placeholder:text-on-surface-variant/20 focus:outline-none focus:ring-0"
                  style={{ borderBottom: "1px solid rgba(72,72,75,0.2)" }}
                  placeholder="Task title"
                />
              </div>
            </div>

            <div>
              <label className="mb-4 block text-[10px] uppercase tracking-widest text-outline">
                Description &amp; Intent
              </label>
              <div className="min-h-[200px] bg-surface-container-low p-6 ghost">
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="min-h-[120px] w-full resize-y border-none bg-transparent leading-relaxed text-on-surface-variant placeholder:text-on-surface-variant/20 focus:outline-none focus:ring-0"
                  placeholder="Describe the desired outcome and critical success factors..."
                />
              </div>
            </div>
          </div>
        </section>

        {/* 02 Execution Parameters */}
        <section className="space-y-8">
          <div className="flex items-baseline gap-4 ghost-b pb-2">
            <span className="font-mono text-xs text-secondary">02</span>
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-on-surface-variant">
              Execution Parameters
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-[10px] uppercase tracking-widest text-outline">
                Assign Agent
              </label>
              <div className="relative">
                <select
                  value={assignedAgentId}
                  onChange={(event) => {
                    const nextAssignedAgentId = event.target.value;
                    setAssignedAgentId(nextAssignedAgentId);

                    if (handoffAgentId === nextAssignedAgentId) {
                      setHandoffAgentId("");
                    }
                  }}
                  disabled={isLoadingOptions || agents.length === 0}
                  className="w-full appearance-none bg-surface-container-low px-4 py-3 text-sm text-on-surface ghost focus:outline-none focus:ring-0 disabled:opacity-50"
                >
                  {agents.length === 0 && !isLoadingOptions ? (
                    <option value="">No agents available</option>
                  ) : null}
                  {assignedAgentId &&
                    !agents.some((a) => a.id === assignedAgentId) ? (
                    <option value={assignedAgentId}>
                      {task.assignedAgent?.name ?? assignedAgentId}
                    </option>
                  ) : null}
                  {assignedAgents.length > 0 ? (
                    <optgroup label="Assigned to this project">
                      {assignedAgents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name} ({agent.role})
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                  {unassignedAgents.length > 0 ? (
                    <optgroup label="Available to assign">
                      {unassignedAgents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name} ({agent.role}) - will be assigned
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                </select>
                <Icon
                  name="expand_more"
                  size={18}
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-outline"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-[10px] uppercase tracking-widest text-outline">
                Auto handoff on completion
              </label>
              <div className="relative">
                <select
                  value={handoffAgentId}
                  onChange={(event) => setHandoffAgentId(event.target.value)}
                  disabled={isLoadingOptions || agents.length === 0}
                  className="w-full appearance-none bg-surface-container-low px-4 py-3 text-sm text-on-surface ghost focus:outline-none focus:ring-0 disabled:opacity-50"
                >
                  <option value="">None</option>
                  {assignedAgents
                    .filter((agent) => agent.id !== assignedAgentId)
                    .length > 0 ? (
                    <optgroup label="Assigned to this project">
                      {assignedAgents
                        .filter((agent) => agent.id !== assignedAgentId)
                        .map((agent) => (
                          <option key={agent.id} value={agent.id}>
                            {agent.name} ({agent.role})
                          </option>
                        ))}
                    </optgroup>
                  ) : null}
                  {unassignedAgents
                    .filter((agent) => agent.id !== assignedAgentId)
                    .length > 0 ? (
                    <optgroup label="Available to assign">
                      {unassignedAgents
                        .filter((agent) => agent.id !== assignedAgentId)
                        .map((agent) => (
                          <option key={agent.id} value={agent.id}>
                            {agent.name} ({agent.role}) - will be assigned
                          </option>
                        ))}
                    </optgroup>
                  ) : null}
                </select>
                <Icon
                  name="expand_more"
                  size={18}
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-outline"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-[10px] uppercase tracking-widest text-outline">
                Git worktree isolation
              </label>
              <button
                type="button"
                onClick={() => setUseGitWorktree((current) => !current)}
                className="flex w-full items-start justify-between gap-4 bg-surface-container-low px-4 py-3 ghost"
              >
                <div className="text-left">
                  <p className="text-sm text-on-surface">
                    {useGitWorktree ? "Enabled" : "Disabled"}
                  </p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    {useGitWorktree
                      ? "Run this ticket in its own isolated Git worktree and task branch."
                      : "Use the shared Execution Target directly and switch the task branch in that checkout."}
                  </p>
                </div>
                <span
                  className={`mt-0.5 inline-flex h-6 w-11 rounded-full p-1 transition-colors ${
                    useGitWorktree ? "bg-secondary/20" : "bg-outline/15"
                  }`}
                >
                  <span
                    className={`h-4 w-4 rounded-full transition-transform ${
                      useGitWorktree
                        ? "translate-x-5 bg-secondary"
                        : "translate-x-0 bg-on-surface-variant/50"
                    }`}
                  />
                </span>
              </button>
            </div>

            <div>
              <label className="mb-2 block text-[10px] uppercase tracking-widest text-outline">
                Status
              </label>
              <div className="relative">
                <select
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as typeof status)
                  }
                  className="w-full appearance-none bg-surface-container-low px-4 py-3 text-sm text-on-surface ghost focus:outline-none focus:ring-0"
                >
                  {statuses.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <Icon
                  name="expand_more"
                  size={18}
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-outline"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-[10px] uppercase tracking-widest text-outline">
                Priority
              </label>
              <div className="flex gap-2">
                {priorities.map((entry) => (
                  <button
                    key={entry.value}
                    type="button"
                    onClick={() => setPriority(entry.value)}
                    className={`flex-1 py-2.5 text-[10px] font-medium uppercase tracking-widest transition-all ${
                      priority === entry.value
                        ? entry.value === "critical"
                          ? "bg-error/15 text-error"
                          : "bg-secondary/15 text-secondary"
                        : "bg-surface-container-low text-on-surface-variant/40 hover:text-on-surface-variant"
                    }`}
                  >
                    {entry.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-[10px] uppercase tracking-widest text-outline">
                Deadline
              </label>
              <input
                type="date"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
                onClick={(event) =>
                  (event.target as HTMLInputElement).showPicker()
                }
                className="w-full bg-surface-container-low px-4 py-3 text-sm text-on-surface ghost focus:outline-none focus:ring-0 cursor-pointer"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-[10px] uppercase tracking-widest text-outline">
                Execution Target Override
              </label>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleBrowseExecutionTarget}
                  disabled={isPickingDirectory || isSubmitting}
                  className="w-full flex items-center gap-3 bg-surface-container-low px-4 py-3 text-left ghost transition-all disabled:cursor-wait disabled:opacity-70"
                >
                  <Icon
                    name={isPickingDirectory ? "progress_activity" : "folder_open"}
                    size={16}
                    className="shrink-0 text-on-surface-variant"
                  />
                  <span
                    className={`flex-1 truncate text-sm font-mono ${
                      displayedExecutionTarget
                        ? "text-secondary"
                        : "text-on-surface-variant/40"
                    }`}
                  >
                    {displayedExecutionTarget || "Select a directory..."}
                  </span>
                </button>
                <div className="flex items-center justify-between gap-3 text-xs text-on-surface-variant">
                  <p>
                    {executionTargetOverride
                      ? "Using a task-specific execution directory."
                      : "Using the project root by default."}
                  </p>
                  {executionTargetOverride ? (
                    <button
                      type="button"
                      onClick={() => setExecutionTargetOverride("")}
                      className="font-mono text-[10px] uppercase tracking-[0.18em] text-secondary transition-colors hover:text-on-surface"
                    >
                      Use project root
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-[10px] uppercase tracking-widest text-outline">
                Labels
              </label>
              <input
                type="text"
                value={labels}
                onChange={(event) => setLabels(event.target.value)}
                className="w-full bg-surface-container-low px-4 py-3 text-sm text-on-surface ghost placeholder:text-on-surface-variant/25 focus:outline-none focus:ring-0"
                placeholder="backend, monitor, launch"
              />
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="flex flex-col items-center justify-between gap-6 pt-12 ghost-t md:flex-row">
          <Link
            href={`/projects/${projectId}/board/${task.id}`}
            className="group flex items-center gap-2 text-on-surface-variant transition-colors hover:text-on-surface"
          >
            <Icon
              name="west"
              size={20}
              className="transition-transform group-hover:-translate-x-1"
            />
            <span className="text-sm font-medium">Cancel</span>
          </Link>
          <div className="flex w-full items-center gap-4 md:w-auto">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 flex items-center justify-center gap-2 rounded-sm bg-primary px-12 py-3 text-sm font-bold text-on-primary transition-all active:scale-[0.98] disabled:opacity-50 md:flex-none"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
              <Icon name={isSubmitting ? "sync" : "check"} size={16} />
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}
