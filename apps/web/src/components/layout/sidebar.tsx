"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";

const overviewLinks = [
  { href: "/", icon: "dashboard", label: "Dashboard" },
  { href: "/projects", icon: "folder_open", label: "Projects", count: "3" },
  { href: "/agents", icon: "smart_toy", label: "Agents", count: "12", countColor: "text-tertiary/40" },
  { href: "/projects/proj-mkt-auto/board", icon: "view_kanban", label: "Tasks" },
];

const systemLinks = [
  { href: "/logs", icon: "terminal", label: "Logs" },
  { href: "/workspaces", icon: "workspaces", label: "Workspaces" },
  { href: "/settings", icon: "settings", label: "Settings" },
];

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-surface-container-low flex flex-col z-40 ghost-r">
      {/* Brand */}
      <div className="px-6 pt-7 pb-5">
        <h1 className="text-[17px] font-extrabold tracking-[-0.04em] text-on-surface">
          Obsidian
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
          <div className="w-8 h-8 rounded-sm bg-surface-container-high overflow-hidden">
            <div className="w-full h-full bg-surface-container-highest" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold truncate text-on-surface/70">
              admin_root
            </p>
            <p className="font-mono text-[7px] text-tertiary/50 uppercase tracking-[0.15em]">
              Authenticated
            </p>
          </div>
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
          link.href === "/"
            ? pathname === "/"
            : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
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
