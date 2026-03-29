"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";

const agents = [
  "Sigma-04 (Strategic)",
  "Delta-9 (Creative)",
  "Agent Vulcan (Deployment)",
  "Psi-Alpha (Integrity)",
  "Orion-X (Content)",
  "SyncMaster (Orchestration)",
];

const priorities = ["Low", "Medium", "High", "Urgent"];

export default function NewTaskPage() {
  const router = useRouter();
  const [priority, setPriority] = useState("Medium");

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back */}
      <Link
        href="/projects/proj-mkt-auto/board"
        className="text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-1.5 text-sm mb-6 anim-1"
      >
        <Icon name="arrow_back" size={16} />
        Task Board
      </Link>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-outline mb-4 anim-1">
        <span className="text-xs font-mono tracking-widest uppercase">
          System.Task.Init
        </span>
        <span className="h-px w-8 bg-outline-variant/30" />
      </div>

      {/* Header */}
      <header className="mb-16 anim-1">
        <h1 className="text-4xl font-light text-on-surface tracking-tight leading-tight">
          Create New Task
        </h1>
        <p className="mt-4 text-on-surface-variant font-light max-w-xl leading-relaxed">
          Define parameters for the next objective. The system will orchestrate
          the underlying nodes to ensure execution integrity.
        </p>
      </header>

      <form
        className="space-y-24"
        onSubmit={(e) => {
          e.preventDefault();
          router.back();
        }}
      >
        {/* 01 Task Definition */}
        <section className="space-y-8 anim-2">
          <div className="flex items-baseline gap-4 ghost-b pb-2">
            <span className="text-secondary font-mono text-xs">01</span>
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-on-surface-variant">
              Task Definition
            </h2>
          </div>
          <div className="space-y-12">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-outline mb-2">
                Objective Title
              </label>
              <input
                type="text"
                className="w-full bg-transparent text-2xl font-light text-on-surface placeholder:text-on-surface-variant/20 pb-4 border-none focus:ring-0 focus:outline-none"
                style={{ borderBottom: "1px solid rgba(72,72,75,0.2)" }}
                onFocus={(e) =>
                  (e.target.style.borderBottom = "1px solid #7b99ff")
                }
                onBlur={(e) =>
                  (e.target.style.borderBottom =
                    "1px solid rgba(72,72,75,0.2)")
                }
                placeholder="Quantum Ledger Synchronization"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-outline mb-4">
                Description &amp; Intent
              </label>
              <div className="bg-surface-container-low ghost p-6 min-h-[200px]">
                <div className="flex gap-4 mb-4 ghost-b pb-4">
                  <button
                    type="button"
                    className="text-outline hover:text-on-surface transition-colors"
                  >
                    <Icon name="format_bold" size={18} />
                  </button>
                  <button
                    type="button"
                    className="text-outline hover:text-on-surface transition-colors"
                  >
                    <Icon name="format_italic" size={18} />
                  </button>
                  <button
                    type="button"
                    className="text-outline hover:text-on-surface transition-colors"
                  >
                    <Icon name="link" size={18} />
                  </button>
                  <span className="w-px h-4 bg-outline-variant/20 my-auto" />
                  <button
                    type="button"
                    className="text-outline hover:text-on-surface transition-colors"
                  >
                    <Icon name="format_list_bulleted" size={18} />
                  </button>
                </div>
                <textarea
                  className="w-full bg-transparent border-none resize-y text-on-surface-variant leading-relaxed min-h-[120px] focus:ring-0 focus:outline-none placeholder:text-on-surface-variant/20"
                  placeholder="Describe the desired outcome and critical success factors..."
                />
              </div>
            </div>
          </div>
        </section>

        {/* 02 Execution Parameters */}
        <section className="space-y-8 anim-2">
          <div className="flex items-baseline gap-4 ghost-b pb-2">
            <span className="text-secondary font-mono text-xs">02</span>
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-on-surface-variant">
              Execution Parameters
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-outline mb-2">
                Assign Agent
              </label>
              <div className="relative">
                <select className="w-full appearance-none bg-surface-container-low ghost px-4 py-3 text-on-surface text-sm focus:ring-0 focus:outline-none">
                  <option>Select Autonomous Agent</option>
                  {agents.map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
                <Icon
                  name="expand_more"
                  size={18}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-outline pointer-events-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-outline mb-2">
                Priority
              </label>
              <div className="flex gap-2">
                {priorities.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`flex-1 py-2.5 text-[10px] uppercase tracking-widest font-medium transition-all ${
                      priority === p
                        ? p === "Urgent"
                          ? "bg-error/15 text-error"
                          : "bg-secondary/15 text-secondary"
                        : "bg-surface-container-low text-on-surface-variant/40 hover:text-on-surface-variant"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-outline mb-2">
                Workspace Path
              </label>
              <div className="flex items-center bg-surface-container-low ghost px-4 py-3">
                <input
                  type="text"
                  className="bg-transparent border-none p-0 text-sm font-mono text-secondary focus:ring-0 focus:outline-none w-full"
                  defaultValue="/root/projects/alpha/tasks/"
                />
                <Icon
                  name="folder_open"
                  size={18}
                  className="text-outline shrink-0 ml-2"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-outline mb-2">
                Deadline
              </label>
              <input
                type="date"
                className="w-full bg-surface-container-low ghost px-4 py-3 text-on-surface text-sm focus:ring-0 focus:outline-none"
              />
            </div>
          </div>
        </section>

        {/* 03 Context & Attachments */}
        <section className="space-y-8 anim-3">
          <div className="flex items-baseline gap-4 ghost-b pb-2">
            <span className="text-secondary font-mono text-xs">03</span>
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-on-surface-variant">
              Context &amp; Attachments
            </h2>
          </div>
          <div className="space-y-8">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-outline mb-4">
                Reference Materials
              </label>
              <div className="border-2 border-dashed border-outline-variant/10 p-12 text-center hover:border-secondary/40 transition-colors cursor-pointer bg-surface-container-low/30">
                <div className="mb-4">
                  <Icon
                    name="upload_file"
                    size={36}
                    className="text-outline-variant"
                  />
                </div>
                <p className="text-on-surface-variant text-sm">
                  Drop contextual assets here or{" "}
                  <span className="text-secondary underline underline-offset-4">
                    browse system files
                  </span>
                </p>
                <p className="text-[10px] text-outline mt-2 uppercase tracking-tighter">
                  PDF, JSON, MD, TXT (Max 50MB)
                </p>
              </div>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-outline mb-2">
                Technical Instructions
              </label>
              <textarea
                className="w-full bg-surface-container-low ghost px-6 py-4 text-on-surface-variant leading-relaxed min-h-[120px] resize-y focus:ring-0 focus:outline-none placeholder:text-on-surface-variant/20"
                placeholder="Specific constraints, edge cases, or API keys..."
              />
            </div>
          </div>
        </section>

        {/* Footer Actions */}
        <footer className="pt-12 ghost-t flex flex-col md:flex-row items-center justify-between gap-6 anim-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-2 group"
          >
            <Icon
              name="west"
              size={20}
              className="group-hover:-translate-x-1 transition-transform"
            />
            <span className="text-sm font-medium">Discard Draft</span>
          </button>
          <div className="flex items-center gap-4 w-full md:w-auto">
            <button
              type="button"
              className="flex-1 md:flex-none px-8 py-3 bg-surface-container-highest text-on-surface rounded-sm text-sm font-medium hover:bg-surface-bright transition-colors"
            >
              Save as Template
            </button>
            <button
              type="submit"
              className="flex-1 md:flex-none px-12 py-3 bg-primary text-on-primary rounded-sm text-sm font-bold active:scale-[0.98] transition-all"
            >
              Initialize Task
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}
