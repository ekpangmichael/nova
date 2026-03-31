"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { signOut } from "@/lib/auth-client";
import {
  getStoredBoardProjectId,
  onStoredBoardProjectIdChange,
} from "@/lib/board-project-preference";
import { getAgents, getProjects, type ApiAgent, type ApiProjectSummary } from "@/lib/api";

const systemLinks = [
  { href: "/settings", icon: "settings", label: "Settings" },
];

type SidebarProps = {
  sessionUser: {
    displayName: string;
    email: string;
  };
};

export function Sidebar({ sessionUser }: SidebarProps) {
  const router = useRouter();
  const [projects, setProjects] = useState<ApiProjectSummary[]>([]);
  const [agents, setAgents] = useState<ApiAgent[]>([]);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [preferredBoardProjectId, setPreferredBoardProjectId] = useState<string | null>(null);

  useEffect(() => {
    setPreferredBoardProjectId(getStoredBoardProjectId());

    return onStoredBoardProjectIdChange((projectId) => {
      setPreferredBoardProjectId(projectId);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([getProjects(), getAgents()])
      .then(([projectRows, agentRows]) => {
        if (cancelled) {
          return;
        }

        setProjects(projectRows);
        setAgents(agentRows);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setProjects([]);
        setAgents([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const preferredBoardProject =
    projects.find((project) => project.id === preferredBoardProjectId) ?? null;
  const primaryBoardProject = preferredBoardProject ?? projects[0] ?? null;
  const overviewLinks: NavLink[] = [
    { href: "/", icon: "dashboard", label: "Dashboard", match: "dashboard" },
    {
      href: "/projects",
      icon: "folder_open",
      label: "Projects",
      count: projects.length > 0 ? String(projects.length) : undefined,
      match: "projects",
    },
    {
      href: "/agents",
      icon: "smart_toy",
      label: "Agents",
      count: agents.length > 0 ? String(agents.length) : undefined,
      countColor: "text-tertiary/40",
      match: "agents",
    },
    {
      href: primaryBoardProject ? `/projects/${primaryBoardProject.id}/board` : "/projects",
      icon: "view_kanban",
      label: "Tasks",
      match: "tasks",
    },
  ];

  const initial =
    sessionUser.displayName.trim().charAt(0) ||
    sessionUser.email.trim().charAt(0) ||
    "O";

  const handleSignOut = async () => {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);

    try {
      await signOut();
      router.push("/signin");
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-surface-container-low flex flex-col z-40 ghost-r">
      {/* Brand */}
      <div className="px-6 pt-7 pb-5">
        <h1 className="text-[17px] font-extrabold tracking-[-0.04em] text-on-surface">
          Nova
        </h1>
        <p className="font-mono text-[8px] text-primary/25 uppercase tracking-[0.25em] mt-0.5">
          Protocol v1.0
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-6">
        <NavSection label="Overview" links={overviewLinks} />
        <NavSection label="System" links={systemLinks} />
      </nav>

      {/* User Profile */}
      <div className="p-4 ghost-t">
        <div className="flex items-center gap-3 p-2.5 bg-surface-container-lowest/20 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-secondary/30 to-tertiary/20 flex items-center justify-center shrink-0">
            <span className="text-[11px] font-bold text-on-surface/70">
              {initial.toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold truncate text-on-surface/70">
              {sessionUser.displayName}
            </p>
            <p className="font-mono text-[7px] text-on-surface-variant/30 uppercase tracking-[0.15em]">
              {sessionUser.email}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              void handleSignOut();
            }}
            disabled={isSigningOut}
            className="flex items-center gap-1 rounded-sm px-2 py-1 text-[10px] font-mono uppercase tracking-[0.16em] text-on-surface-variant/35 transition-colors hover:text-on-surface-variant/65 disabled:opacity-50"
          >
            <Icon
              name="logout"
              size={14}
              className="shrink-0"
            />
            <span>{isSigningOut ? "Exit..." : "Exit"}</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

type NavLink = {
  href: string;
  icon: string;
  label: string;
  count?: string;
  countColor?: string;
  match?: "dashboard" | "projects" | "agents" | "tasks";
};

function NavSection({ label, links }: { label: string; links: NavLink[] }) {
  const pathname = usePathname();

  return (
    <div>
      <p className="px-4 mb-1.5 text-[8px] font-mono text-outline/40 uppercase tracking-[0.2em]">
        {label}
      </p>
      {links.map((link) => {
        const isActive =
          link.match === "dashboard"
            ? pathname === "/"
            : link.match === "tasks"
              ? pathname.startsWith("/projects/") && pathname.includes("/board")
              : link.match === "projects"
                ? pathname === "/projects" || (pathname.startsWith("/projects/") && !pathname.includes("/board"))
                : link.match === "agents"
                  ? pathname === "/agents" || pathname.startsWith("/agents/")
                  : link.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(link.href);

        return (
          <Link
            key={`${label}-${link.label}`}
            href={link.href}
            className={
              isActive
                ? "nav-active flex items-center gap-3 px-4 py-2.5 text-on-surface border-l-2 border-secondary rounded-r transition-all duration-200"
                : "flex items-center gap-3 px-4 py-2.5 text-on-surface-variant/40 hover:text-on-surface-variant/70 hover:bg-surface-container/30 border-l-2 border-transparent transition-all duration-200"
            }
          >
            <Icon
              name={link.icon}
              className={isActive ? "text-secondary" : undefined}
            />
            <span className="text-[13px] font-medium">{link.label}</span>
            {link.count && (
              <span
                className={`ml-auto font-mono text-[8px] ${link.countColor ?? "text-on-surface-variant/20"}`}
              >
                {link.count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
