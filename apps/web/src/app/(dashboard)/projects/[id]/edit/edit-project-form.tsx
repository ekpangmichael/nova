"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import {
  ApiError,
  patchProject,
  selectProjectRootDirectory,
} from "@/lib/api";
import type { ApiProjectDetail } from "@/lib/api";

export function EditProjectForm({ project }: { project: ApiProjectDetail }) {
  const router = useRouter();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [status, setStatus] = useState<"active" | "paused" | "archived">(project.status);
  const [projectRoot, setProjectRoot] = useState(project.projectRoot);
  const [seedType, setSeedType] = useState<"none" | "git">(project.seedType);
  const [seedUrl, setSeedUrl] = useState(project.seedUrl ?? "");
  const [tagsInput, setTagsInput] = useState(project.tags.join(", "));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPickingDirectory, setIsPickingDirectory] = useState(false);

  async function handleBrowseProjectRoot() {
    setErrorMessage(null);
    setIsPickingDirectory(true);

    try {
      const selection = await selectProjectRootDirectory();
      if (selection.path) {
        setProjectRoot(selection.path);
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

    if (!name.trim()) {
      setErrorMessage("Project name is required.");
      return;
    }

    if (!projectRoot.trim()) {
      setErrorMessage("Project root is required.");
      return;
    }

    if (seedType === "git" && !seedUrl.trim()) {
      setErrorMessage("Repository URL is required for Git projects.");
      return;
    }

    setIsSubmitting(true);

    try {
      const updatedProject = await patchProject(project.id, {
        name: name.trim(),
        description: description.trim() || "",
        status,
        projectRoot: projectRoot.trim(),
        seedType,
        seedUrl: seedType === "git" ? seedUrl.trim() || null : null,
        tags: tagsInput
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      });

      router.push(`/projects/${updatedProject.id}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "Unable to save the project right now."
      );
      setIsSubmitting(false);
      return;
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-12">
      <Link
        href={`/projects/${project.id}`}
        className="text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-1.5 text-sm mb-8 anim-1"
      >
        <Icon name="arrow_back" size={16} />
        {project.name}
      </Link>

      <div className="mb-16 anim-1">
        <div className="flex items-center gap-3 mb-3">
          <span className="font-mono text-[10px] text-on-surface-variant/40 uppercase tracking-widest">
            {project.id}
          </span>
        </div>
        <h1 className="text-4xl font-light tracking-tight text-on-surface mb-3">
          Edit Project
        </h1>
        <p className="text-on-surface-variant text-base leading-relaxed max-w-lg">
          Update the configuration for this project. Changes will be reflected
          across all assigned agents.
        </p>
      </div>

      <form className="space-y-12" onSubmit={handleSubmit}>
        {/* Identity */}
        <div className="space-y-8 anim-2">
          <div className="group border-b border-outline-variant/10 pb-2">
            <label className="block text-[10px] uppercase tracking-[0.2em] text-on-surface-variant mb-1 font-medium">
              Project Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full bg-transparent border-none p-0 text-xl text-on-surface placeholder:text-surface-container-highest focus:ring-0 focus:outline-none"
              placeholder="Untitled-Operation-01"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-[0.2em] text-on-surface-variant mb-2 font-medium">
              Description
            </label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="w-full bg-surface-container-low p-4 text-on-surface placeholder:text-on-surface-variant/20 text-sm leading-relaxed resize-y min-h-[100px] border-none focus:ring-0 focus:outline-none"
              placeholder="Brief objectives and tactical scope..."
              rows={4}
            />
          </div>
        </div>

        {/* Configuration Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10 anim-2">
          <div>
            <label className="block text-[10px] uppercase tracking-[0.2em] text-on-surface-variant mb-4 font-medium">
              Project Status
            </label>
            <div className="relative">
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as "active" | "paused" | "archived")
                }
                className="w-full appearance-none bg-surface-container-low text-sm px-4 py-3 rounded-sm ghost focus:border-secondary/50 focus:ring-0 transition-all text-on-surface"
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="archived">Archived</option>
              </select>
              <Icon
                name="expand_more"
                size={18}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-[0.2em] text-on-surface-variant mb-4 font-medium">
              Project Root
            </label>
            <button
              type="button"
              onClick={handleBrowseProjectRoot}
              disabled={isPickingDirectory || isSubmitting}
              className="w-full flex items-center gap-3 bg-surface-container-low rounded-sm ghost hover:border-secondary/30 transition-all px-4 py-3 text-left cursor-pointer disabled:cursor-wait disabled:opacity-70"
            >
              <Icon
                name={isPickingDirectory ? "progress_activity" : "folder_open"}
                size={16}
                className="shrink-0 text-on-surface-variant"
              />
              <span
                className={`text-sm font-mono truncate flex-1 ${
                  projectRoot ? "text-on-surface" : "text-on-surface-variant/40"
                }`}
              >
                {projectRoot || "Select a directory..."}
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10 anim-3">
          <div>
            <label className="block text-[10px] uppercase tracking-[0.2em] text-on-surface-variant mb-4 font-medium">
              Source Type
            </label>
            <div className="relative">
              <select
                value={seedType}
                onChange={(event) =>
                  setSeedType(event.target.value as "none" | "git")
                }
                className="w-full appearance-none bg-surface-container-low text-sm px-4 py-3 rounded-sm ghost focus:border-secondary/50 focus:ring-0 transition-all text-on-surface"
              >
                <option value="none">None</option>
                <option value="git">Git Repository</option>
              </select>
              <Icon
                name="expand_more"
                size={18}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-[0.2em] text-on-surface-variant mb-4 font-medium">
              Tags
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(event) => setTagsInput(event.target.value)}
              className="w-full bg-surface-container-low rounded-sm ghost px-4 py-3 text-sm text-on-surface focus:border-secondary/50 focus:ring-0 transition-all"
              placeholder="marketing, launch, q2"
            />
          </div>
        </div>

        {seedType === "git" ? (
          <div className="anim-3">
            <label className="block text-[10px] uppercase tracking-[0.2em] text-on-surface-variant mb-4 font-medium">
              Repository URL
            </label>
            <input
              type="url"
              value={seedUrl}
              onChange={(event) => setSeedUrl(event.target.value)}
              className="w-full bg-surface-container-low rounded-sm ghost px-4 py-3 text-sm text-on-surface font-mono focus:border-secondary/50 focus:ring-0 transition-all"
              placeholder="https://github.com/example/project.git"
              spellCheck={false}
            />
          </div>
        ) : null}

        {errorMessage ? (
          <div className="border border-error/30 bg-error/10 px-4 py-3 text-sm text-error anim-3">
            {errorMessage}
          </div>
        ) : null}

        <div className="pt-12 flex items-center justify-between ghost-t anim-4">
          <Link
            href={`/projects/${project.id}`}
            className="text-on-surface-variant hover:text-on-surface text-sm transition-colors font-medium"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-primary text-on-primary px-8 py-3 rounded-sm text-sm font-semibold transition-all active:scale-[0.98] hover:opacity-80 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
            <Icon name={isSubmitting ? "sync" : "check"} size={16} />
          </button>
        </div>
      </form>
    </div>
  );
}
