"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { NovaBrand } from "@/components/ui/nova-logo";
import { useMobileNav } from "@/components/layout/mobile-nav-context";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/auth-client";
import {
  getStoredBoardProjectId,
  onStoredBoardProjectIdChange,
} from "@/lib/board-project-preference";
import { getAgents, getProjects, type ApiAgent, type ApiProjectSummary } from "@/lib/api";

type NavLink = {
  href: string;
  icon: string;
  label: string;
  count?: string;
  countColor?: string;
  match?: "dashboard" | "projects" | "agents" | "tasks";
  tourId?: string;
};

const systemLinks: NavLink[] = [
  { href: "/runtimes", icon: "memory", label: "Runtimes", tourId: "nav-runtimes" },
  { href: "/settings", icon: "settings", label: "Settings", tourId: "nav-settings" },
];

type SidebarProps = {
  sessionUser: {
    displayName: string;
    email: string;
  };
};

export function Sidebar({ sessionUser }: SidebarProps) {
  const router = useRouter();
  const { isOpen: isMobileNavOpen, close: closeMobileNav } = useMobileNav();
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
    { href: "/", icon: "dashboard", label: "Dashboard", match: "dashboard", tourId: "nav-dashboard" },
    {
      href: "/projects",
      icon: "folder_open",
      label: "Projects",
      count: projects.length > 0 ? String(projects.length) : undefined,
      match: "projects",
      tourId: "nav-projects",
    },
    {
      href: "/agents",
      icon: "smart_toy",
      label: "Agents",
      count: agents.length > 0 ? String(agents.length) : undefined,
      countColor: "text-tertiary/40",
      match: "agents",
      tourId: "nav-agents",
    },
    {
      href: primaryBoardProject ? `/projects/${primaryBoardProject.id}/board` : "/tasks",
      icon: "view_kanban",
      label: "Tasks",
      match: "tasks",
      tourId: "nav-tasks",
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
    <>
      {/* Backdrop (mobile only, visible when drawer is open) */}
      <button
        type="button"
        aria-label="Close navigation"
        onClick={closeMobileNav}
        className={cn(
          "fixed inset-0 z-30 bg-on-surface/30 backdrop-blur-sm transition-opacity md:hidden",
          isMobileNavOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        )}
      />

      <aside
        data-tour-id="sidebar"
        className={cn(
          "fixed left-0 top-0 h-[100dvh] w-[min(80vw,18rem)] md:w-64 bg-surface-container-low flex flex-col z-40 ghost-r transition-transform duration-200",
          isMobileNavOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Brand row with mobile close button */}
        <div className="flex items-center justify-between px-6 pt-7 pb-5">
          <NovaBrand />
          <button
            type="button"
            onClick={closeMobileNav}
            className="md:hidden flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant/50 hover:text-on-surface hover:bg-surface-container/60 transition-colors"
            aria-label="Close navigation"
          >
            <Icon name="close" size={18} />
          </button>
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
            <span>{isSigningOut ? "Signing out..." : "Sign out"}</span>
          </button>
        </div>
      </div>
      </aside>
    </>
  );
}

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
            data-tour-id={link.tourId}
            className={
              isActive
                ? "nav-active flex items-center gap-3 px-4 py-2.5 nav-active-bg rounded-lg transition-all duration-200"
                : "flex items-center gap-3 px-4 py-2.5 text-on-surface-variant/40 hover:text-on-surface-variant/70 hover:bg-surface-container/30 rounded-lg transition-all duration-200"
            }
          >
            <Icon
              name={link.icon}
              className={isActive ? "nav-active-icon" : undefined}
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
