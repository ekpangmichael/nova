"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { triggerTour } from "@/lib/tour";

export function TopBar() {
  const pathname = usePathname();
  type NavLink = {
    href: string;
    label: string;
    isActive: boolean;
  };

  const navLinks: NavLink[] = [
    {
      href: "/",
      label: "Home",
      isActive: pathname === "/",
    },
    {
      href: "/projects",
      label: "Projects",
      isActive:
        pathname === "/projects" ||
        (pathname.startsWith("/projects/") && !pathname.includes("/board")),
    },
    {
      href: "/agents",
      label: "Agents",
      isActive: pathname === "/agents" || pathname.startsWith("/agents/"),
    },
    {
      href: "/tasks/new",
      label: "Tasks",
      isActive:
        pathname.includes("/board") ||
        pathname.startsWith("/tasks"),
    },
  ];

  return (
    <header data-tour-id="top-bar" className="sticky top-0 z-50 flex items-center justify-between h-14 px-8 bg-surface/60 backdrop-blur-2xl ghost-b">
      {/* Nav Tabs */}
      <nav className="flex items-center gap-1">
        {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                link.isActive
                  ? "px-3 py-1 text-[11px] font-medium text-secondary bg-secondary/[0.07] rounded-sm transition-colors"
                  : "px-3 py-1 text-[11px] text-on-surface-variant/30 hover:text-on-surface-variant/60 transition-colors"
              }
            >
              {link.label}
            </Link>
          ))}
      </nav>

      <div className="flex items-center gap-3">
        <button className="relative p-1.5 text-on-surface-variant/30 hover:text-on-surface-variant/70 transition-colors">
          <Icon name="notifications" />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-error rounded-full" />
        </button>
        <button
          data-tour-id="help-button"
          onClick={() => triggerTour()}
          className="p-1.5 text-on-surface-variant/30 hover:text-on-surface-variant/70 transition-colors"
        >
          <Icon name="help_outline" />
        </button>
      </div>
    </header>
  );
}
