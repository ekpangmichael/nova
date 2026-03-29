import Link from "next/link";
import { Icon } from "@/components/ui/icon";

export function NewProjectCard() {
  return (
    <Link
      href="/projects/new"
      className="border-2 border-dashed border-outline-variant/20 hover:border-secondary/40 transition-colors flex flex-col items-center justify-center p-8 group cursor-pointer"
    >
      <div className="w-12 h-12 rounded-full bg-surface-container group-hover:bg-secondary/10 flex items-center justify-center transition-all mb-4">
        <Icon
          name="add_circle"
          size={24}
          className="text-on-surface-variant group-hover:text-secondary"
        />
      </div>
      <p className="text-on-surface font-bold uppercase tracking-widest text-sm">
        Initialize New Protocol
      </p>
      <p className="text-on-surface-variant font-mono text-[10px] mt-1">
        Allocate resources &amp; define parameters
      </p>
    </Link>
  );
}
