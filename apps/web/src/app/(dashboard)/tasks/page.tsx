"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { getProjects, type ApiProjectSummary } from "@/lib/api";

export default function TasksPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ApiProjectSummary[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const result = await getProjects();

        if (cancelled) {
          return;
        }

        if (result.length > 0) {
          router.replace(`/projects/${result[0].id}/board`);
          return;
        }

        setProjects(result);
      } catch {
        if (!cancelled) {
          setProjects([]);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [router]);

  // Still loading or about to redirect
  if (projects === null) {
    return (
      <div className="flex items-center justify-center py-32">
        <Icon
          name="progress_activity"
          size={24}
          className="animate-spin text-on-surface-variant/30"
        />
      </div>
    );
  }

  // No projects — show empty state
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/10">
        <Icon name="view_kanban" size={28} className="text-secondary" />
      </div>

      <h2 className="text-lg font-semibold text-on-surface">
        No projects yet
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
        Tasks live inside projects. Create your first project and you can start
        adding tasks to it right away.
      </p>

      <Link
        href="/projects/new"
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-secondary/15 px-5 py-2.5 text-sm font-medium text-secondary transition-colors hover:bg-secondary/25"
      >
        <Icon name="add" size={16} />
        Create a project
      </Link>
    </div>
  );
}
