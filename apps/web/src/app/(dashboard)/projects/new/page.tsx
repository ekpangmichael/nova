"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import {
  ApiError,
  createProject,
  selectProjectRootDirectory,
} from "@/lib/api";

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"active" | "paused" | "archived">("active");
  const [projectRoot, setProjectRoot] = useState("");
  const [seedType, setSeedType] = useState<"none" | "git">("none");
  const [seedUrl, setSeedUrl] = useState("");
  const [tagsInput, setTagsInput] = useState("");
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
      const project = await createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        status,
        projectRoot: projectRoot.trim(),
        seedType,
        seedUrl: seedType === "git" ? seedUrl.trim() : null,
        tags: tagsInput
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      });

      router.push(`/projects/${project.id}`);
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "Unable to create the project. Confirm the backend is running and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-12">
      {/* Back */}
      <Link
        href="/projects"
        className="text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-1.5 text-sm mb-8 anim-1"
      >
        <Icon name="arrow_back" size={16} />
        Projects
      </Link>

      {/* Header */}
      <div className="mb-16 anim-1">
        <h1 className="text-4xl font-light tracking-tight text-on-surface mb-3">
          New Project
        </h1>
        <p className="text-on-surface-variant text-base leading-relaxed max-w-lg">
          Set up a new project workspace. You can assign agents and create tasks after the project is created.
        </p>
      </div>

      {/* Form */}
      <form className="space-y-12" onSubmit={handleSubmit}>
        {/* Identity Section */}
        <div className="space-y-8 anim-2">
          <div>
            <label className="block text-[10px] uppercase tracking-[0.2em] text-on-surface-variant mb-4 font-medium">
              Project Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full bg-surface-container-low rounded-sm ghost px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/20 focus:border-secondary/50 focus:ring-0 transition-all"
              placeholder="e.g. Marketing Website Redesign"
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
              placeholder="What is this project about?"
              rows={4}
            />
          </div>
        </div>

        {/* Configuration Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10 anim-2">
          {/* Status */}
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

          {/* Project Root */}
          <div>
            <label className="block text-[10px] uppercase tracking-[0.2em] text-on-surface-variant mb-4 font-medium">
              Default Project Root
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
                  projectRoot
                    ? "text-on-surface"
                    : "text-on-surface-variant/40"
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

        {/* Footer Actions */}
        <div className="pt-12 flex items-center justify-between ghost-t anim-4">
          <Link
            href="/projects"
            className="text-on-surface-variant hover:text-on-surface text-sm transition-colors font-medium"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-primary text-on-primary px-8 py-3 rounded-sm text-sm font-semibold transition-all active:scale-[0.98] hover:opacity-80 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? "Creating..." : "Create Project"}
            <Icon name={isSubmitting ? "sync" : "arrow_forward"} size={16} />
          </button>
        </div>
      </form>
    </div>
  );
}
