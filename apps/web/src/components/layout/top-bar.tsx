import { Icon } from "@/components/ui/icon";

export function TopBar() {
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between h-14 px-8 bg-surface/60 backdrop-blur-2xl ghost-b">
      <div className="flex items-center gap-6">
        {/* Search */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-container-lowest/30 ghost rounded-sm">
          <Icon name="search" size={14} className="text-outline/30" />
          <input
            type="text"
            className="bg-transparent border-none focus:ring-0 text-[11px] w-44 font-mono placeholder:text-outline/25 text-on-surface-variant p-0"
            placeholder="Search agents, tasks, logs..."
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[8px] font-mono text-outline/30 bg-surface-container/40 rounded-sm">
            &#8984;K
          </kbd>
        </div>

        {/* Project Tabs */}
        <nav className="flex items-center gap-1">
          <a
            href="#"
            className="px-3 py-1 text-[11px] font-medium text-secondary bg-secondary/[0.07] rounded-sm transition-colors"
          >
            Project Alpha
          </a>
          <a
            href="#"
            className="px-3 py-1 text-[11px] text-on-surface-variant/30 hover:text-on-surface-variant/60 transition-colors"
          >
            Project Beta
          </a>
          <a
            href="#"
            className="px-3 py-1 text-[11px] text-on-surface-variant/30 hover:text-on-surface-variant/60 transition-colors"
          >
            Codebase Ops
          </a>
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <button className="relative p-1.5 text-on-surface-variant/30 hover:text-on-surface-variant/70 transition-colors">
          <Icon name="notifications" />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-error rounded-full" />
        </button>
        <button className="p-1.5 text-on-surface-variant/30 hover:text-on-surface-variant/70 transition-colors">
          <Icon name="help_outline" />
        </button>
        <div className="h-3.5 w-px bg-outline-variant/8 mx-1" />
        <div className="flex items-center gap-2">
          <span className="font-mono text-[8px] text-on-surface-variant/35 uppercase tracking-[0.1em]">
            System: Nominal
          </span>
          <div className="w-1.5 h-1.5 rounded-full bg-tertiary pulse-green" />
        </div>
      </div>
    </header>
  );
}
