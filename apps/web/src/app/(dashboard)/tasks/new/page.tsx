"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import {
  ApiError,
  type ApiAgent,
  type ApiProjectSummary,
  assignAgentToProject,
  createTask,
  getAgents,
  getProjects,
  selectExecutionTargetDirectory,
  uploadTaskAttachment,
} from "@/lib/api";
import {
  MAX_TASK_ATTACHMENT_BYTES,
  TASK_ATTACHMENT_ACCEPT_ATTR,
  isAllowedTaskAttachment,
} from "@/lib/task-attachments";

const priorities = [
  { label: "Low", value: "low" as const },
  { label: "Medium", value: "medium" as const },
  { label: "High", value: "high" as const },
  { label: "Urgent", value: "critical" as const },
];

function combineDescription(description: string, technicalInstructions: string) {
  const trimmedDescription = description.trim();
  const trimmedTechnicalInstructions = technicalInstructions.trim();

  if (!trimmedTechnicalInstructions) {
    return trimmedDescription;
  }

  if (!trimmedDescription) {
    return `Technical Instructions\n${trimmedTechnicalInstructions}`;
  }

  return `${trimmedDescription}\n\nTechnical Instructions\n${trimmedTechnicalInstructions}`;
}

function formatAllowedAttachmentSummary() {
  return "PDF, JSON, MD, TXT, HTML, CSS, JS, TS, PY, XML, DOC, DOCX, images (max 25MB each)";
}

function NewTaskPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryProjectId = searchParams.get("projectId");

  const [projects, setProjects] = useState<ApiProjectSummary[]>([]);
  const [agents, setAgents] = useState<ApiAgent[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [assignedAgentId, setAssignedAgentId] = useState("");
  const [handoffAgentId, setHandoffAgentId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<(typeof priorities)[number]["value"]>("medium");
  const [executionTargetOverride, setExecutionTargetOverride] = useState("");
  const [useGitWorktree, setUseGitWorktree] = useState(false);
  const [dueAt, setDueAt] = useState("");
  const [labels, setLabels] = useState("");
  const [technicalInstructions, setTechnicalInstructions] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPickingDirectory, setIsPickingDirectory] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      setIsLoading(true);

      try {
        const [nextProjects, nextAgents] = await Promise.all([getProjects(), getAgents()]);

        if (cancelled) {
          return;
        }

        setProjects(nextProjects);
        setAgents(nextAgents);

        const initialProjectId =
          (queryProjectId &&
          nextProjects.some((project) => project.id === queryProjectId)
            ? queryProjectId
            : nextProjects[0]?.id) ?? "";
        const initialProject =
          nextProjects.find((project) => project.id === initialProjectId) ?? null;
        setSelectedProjectId(initialProjectId);
        setExecutionTargetOverride(initialProject?.projectRoot ?? "");

        const initialAgentId =
          nextAgents.find((agent) => agent.projectIds.includes(initialProjectId))?.id ??
          nextAgents[0]?.id ??
          "";
        setAssignedAgentId(initialAgentId);
        setErrorMessage(null);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setErrorMessage(
          error instanceof ApiError
            ? error.message
            : "Unable to load projects and agents."
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadOptions();

    return () => {
      cancelled = true;
    };
  }, [queryProjectId]);

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;
  const assignedAgents = agents.filter((agent) => agent.projectIds.includes(selectedProjectId));
  const unassignedAgents = agents.filter((agent) => !agent.projectIds.includes(selectedProjectId));
  const selectedAgent = agents.find((agent) => agent.id === assignedAgentId) ?? null;
  const displayedExecutionTarget = executionTargetOverride || selectedProject?.projectRoot || "";

  async function handleBrowseExecutionTarget() {
    if (!selectedProject) {
      setErrorMessage("Select a project first.");
      return;
    }

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

    if (!selectedProjectId) {
      setErrorMessage("Select a project first.");
      return;
    }

    if (!assignedAgentId) {
      setErrorMessage("Select an agent.");
      return;
    }

    if (!title.trim()) {
      setErrorMessage("Objective title is required.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (selectedAgent && !selectedAgent.projectIds.includes(selectedProjectId)) {
        await assignAgentToProject(selectedProjectId, selectedAgent.id);
      }

      const task = await createTask({
        projectId: selectedProjectId,
        title: title.trim(),
        description: combineDescription(description, technicalInstructions),
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

      for (const file of selectedFiles) {
        await uploadTaskAttachment(task.id, file);
      }

      router.push(`/projects/${selectedProjectId}/board/${task.id}`);
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "Unable to create the task."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href={selectedProjectId ? `/projects/${selectedProjectId}/board` : "/projects"}
        className="mb-6 flex items-center gap-1.5 text-sm text-on-surface-variant transition-colors hover:text-on-surface"
      >
        <Icon name="arrow_back" size={16} />
        Task Board
      </Link>

      <header className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight text-on-surface">
          New Task
        </h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          Create a task, assign it to an agent, and optionally attach files for context.
        </p>
      </header>

      {errorMessage ? (
        <div className="mb-8 rounded-sm border border-error/30 bg-error/8 px-4 py-3 text-sm text-error">
          {errorMessage}
        </div>
      ) : null}

      <form className="space-y-12" onSubmit={handleSubmit}>
        <section className="space-y-6">
          <h2 className="text-sm font-semibold text-on-surface-variant">
            Task Details
          </h2>
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs text-on-surface-variant">
                  Project
                </label>
                <div className="relative">
                  <select
                    value={selectedProjectId}
                    onChange={(event) => {
                      const nextProjectId = event.target.value;
                      const nextProject =
                        projects.find((project) => project.id === nextProjectId) ?? null;
                      const nextAssignedAgents = agents.filter((agent) =>
                        agent.projectIds.includes(nextProjectId)
                      );
                      setSelectedProjectId(nextProjectId);
                      setExecutionTargetOverride(nextProject?.projectRoot ?? "");
                      setAssignedAgentId(
                        nextAssignedAgents[0]?.id ?? agents[0]?.id ?? ""
                      );
                      setHandoffAgentId("");
                    }}
                    disabled={isLoading}
                    className="w-full appearance-none bg-surface-container-low px-4 py-3 text-sm text-on-surface ghost focus:outline-none focus:ring-0 disabled:opacity-50"
                  >
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
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

              <div>
                <label className="mb-2 block text-xs text-on-surface-variant">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="w-full bg-surface-container-low rounded-sm ghost px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/20 focus:outline-none focus:ring-0"
                  placeholder="e.g. Fix login redirect on mobile"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs text-on-surface-variant">
                Description
              </label>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="min-h-[120px] w-full resize-y bg-surface-container-low rounded-sm ghost px-4 py-3 text-sm leading-relaxed text-on-surface-variant placeholder:text-on-surface-variant/20 focus:outline-none focus:ring-0"
                placeholder="What should the agent do? Include any relevant details or constraints."
              />
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-sm font-semibold text-on-surface-variant">
            Assignment &amp; Priority
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Row 1: Agent | Handoff */}
            <div>
              <label className="mb-2 block text-xs text-on-surface-variant">
                Agent
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
                  disabled={isLoading || agents.length === 0}
                  className="w-full appearance-none bg-surface-container-low px-4 py-3 text-sm text-on-surface ghost focus:outline-none focus:ring-0 disabled:opacity-50"
                >
                  {agents.length === 0 ? (
                    <option value="">No agents available</option>
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
              <p className="mt-2 text-xs text-on-surface-variant">
                {selectedAgent && !selectedAgent.projectIds.includes(selectedProjectId)
                  ? "This agent will be assigned to the project automatically."
                  : "Pick an agent or choose one to assign automatically."}
              </p>
            </div>

            <div>
              <label className="mb-2 block text-xs text-on-surface-variant">
                Handoff to
              </label>
              <div className="relative">
                <select
                  value={handoffAgentId}
                  onChange={(event) => setHandoffAgentId(event.target.value)}
                  disabled={isLoading || agents.length === 0}
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
              <p className="mt-2 text-xs text-on-surface-variant">
                Optionally pass the task to another agent after completion.
              </p>
            </div>

            {/* Row 2: Priority | Due date */}
            <div>
              <label className="mb-2 block text-xs text-on-surface-variant">
                Priority
              </label>
              <div className="flex gap-2">
                {priorities.map((entry) => (
                  <button
                    key={entry.value}
                    type="button"
                    onClick={() => setPriority(entry.value)}
                    className={`flex-1 rounded-sm py-2.5 text-[11px] font-medium uppercase tracking-wider transition-all ${
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
              <label className="mb-2 block text-xs text-on-surface-variant">
                Due date
              </label>
              <input
                type="date"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
                onClick={(event) => (event.target as HTMLInputElement).showPicker()}
                className="w-full bg-surface-container-low px-4 py-3 text-sm text-on-surface ghost focus:outline-none focus:ring-0 cursor-pointer"
              />
            </div>

            {/* Row 3: Working Directory | Labels */}
            <div>
              <label className="mb-2 block text-xs text-on-surface-variant">
                Working Directory
              </label>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleBrowseExecutionTarget}
                  disabled={isPickingDirectory || isSubmitting || !selectedProject}
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
                      ? "Using a custom directory for this task."
                      : "Using the project root by default."}
                  </p>
                  {executionTargetOverride ? (
                    <button
                      type="button"
                      onClick={() => setExecutionTargetOverride("")}
                      className="text-xs text-secondary transition-colors hover:text-on-surface"
                    >
                      Reset to project root
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs text-on-surface-variant">
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

            {/* Git worktree isolation — full-width toggle */}
            <div className="md:col-span-2">
              <button
                type="button"
                onClick={() => setUseGitWorktree((current) => !current)}
                className={`group flex w-full items-center gap-4 rounded-lg border px-4 py-3.5 text-left transition-all ${
                  useGitWorktree
                    ? "border-secondary/20 bg-secondary/[0.06]"
                    : "border-outline-variant/10 bg-surface-container-low hover:border-outline-variant/20"
                }`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                    useGitWorktree
                      ? "bg-secondary/15 text-secondary"
                      : "bg-surface-container-high/60 text-on-surface-variant/40"
                  }`}
                >
                  <Icon name="account_tree" size={18} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-on-surface">
                      Use a separate worktree
                    </span>
                    {useGitWorktree && (
                      <span className="rounded-full bg-secondary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-secondary">
                        On
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-on-surface-variant/60">
                    {useGitWorktree
                      ? "The agent works on a copy of the repo so it won't affect your main checkout."
                      : "The agent works directly in the project directory."}
                  </p>
                </div>

                {/* Toggle track */}
                <div
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                    useGitWorktree ? "bg-secondary" : "bg-on-surface-variant/15"
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                      useGitWorktree ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </div>
              </button>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-sm font-semibold text-on-surface-variant">
            Attachments
          </h2>
          <div className="space-y-6">
            <div>
              <label className="mb-2 block text-xs text-on-surface-variant">
                Files
              </label>
              <label className="block cursor-pointer rounded-sm border-2 border-dashed border-outline-variant/15 bg-surface-container-low/30 px-6 py-8 text-center transition-colors hover:border-secondary/40">
                <div className="mb-3">
                  <Icon
                    name="upload_file"
                    size={28}
                    className="text-outline-variant"
                  />
                </div>
                <p className="text-sm text-on-surface-variant">
                  Drop files here or{" "}
                  <span className="text-secondary underline underline-offset-4">
                    browse
                  </span>
                </p>
                <p className="mt-1.5 text-[11px] text-on-surface-variant/40">
                  {formatAllowedAttachmentSummary()}
                </p>
                <input
                  type="file"
                  multiple
                  accept={TASK_ATTACHMENT_ACCEPT_ATTR}
                  className="hidden"
                  onChange={(event) => {
                    const nextFiles = Array.from(event.target.files ?? []);
                    const allowedFiles = nextFiles.filter((file) =>
                      isAllowedTaskAttachment({
                        fileName: file.name,
                        mimeType: file.type,
                      })
                    );
                    const oversizedFiles = allowedFiles.filter(
                      (file) => file.size > MAX_TASK_ATTACHMENT_BYTES
                    );
                    const acceptedFiles = allowedFiles.filter(
                      (file) => file.size <= MAX_TASK_ATTACHMENT_BYTES
                    );
                    const rejectedFiles = nextFiles.filter(
                      (file) =>
                        !isAllowedTaskAttachment({
                          fileName: file.name,
                          mimeType: file.type,
                        })
                    );

                    setSelectedFiles(acceptedFiles);

                    if (rejectedFiles.length > 0) {
                      setErrorMessage(
                        `Unsupported attachment type: ${rejectedFiles
                          .map((file) => file.name)
                          .join(", ")}. Use documents, images, or source files such as PDF, JSON, Markdown, HTML, CSS, JavaScript, Python, XML, DOC, DOCX, TXT, or common image formats.`
                      );
                      return;
                    }

                    if (oversizedFiles.length > 0) {
                      setErrorMessage(
                        `Attachment exceeds the 25 MB limit: ${oversizedFiles
                          .map((file) => file.name)
                          .join(", ")}.`
                      );
                      return;
                    }

                    setErrorMessage(null);
                  }}
                />
              </label>
              {selectedFiles.length > 0 ? (
                <div className="mt-4 space-y-2 text-sm text-on-surface-variant">
                  {selectedFiles.map((file) => (
                    <div
                      key={`${file.name}-${file.size}`}
                      className="flex items-center justify-between rounded-sm bg-surface-container-low px-4 py-3 ghost"
                    >
                      <span>{file.name}</span>
                      <span className="font-mono text-[11px]">
                        {(file.size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div>
              <label className="mb-2 block text-xs text-on-surface-variant">
                Technical notes
              </label>
              <textarea
                value={technicalInstructions}
                onChange={(event) => setTechnicalInstructions(event.target.value)}
                className="min-h-[100px] w-full resize-y bg-surface-container-low rounded-sm ghost px-4 py-3 text-sm leading-relaxed text-on-surface-variant placeholder:text-on-surface-variant/20 focus:outline-none focus:ring-0"
                placeholder="Any constraints, edge cases, or implementation details the agent should know about."
              />
            </div>
          </div>
        </section>

        <footer className="flex items-center justify-end gap-4 border-t border-outline-variant/10 pt-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-sm px-4 py-2.5 text-sm font-medium text-on-surface-variant transition-colors hover:text-on-surface"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || isLoading || agents.length === 0}
            className="rounded-sm bg-primary px-8 py-2.5 text-sm font-semibold text-on-primary transition-all active:scale-[0.98] hover:opacity-80 disabled:opacity-50"
          >
            {isSubmitting ? "Creating…" : "Create Task"}
          </button>
        </footer>
      </form>
    </div>
  );
}

export default function NewTaskPage() {
  return (
    <Suspense fallback={<div className="text-sm text-on-surface-variant">Loading task form…</div>}>
      <NewTaskPageContent />
    </Suspense>
  );
}
