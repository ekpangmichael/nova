import { Icon } from "@/components/ui/icon";
import type { TaskAttachment } from "@/types";

export function TaskAttachments({ attachments }: { attachments: TaskAttachment[] }) {
  if (attachments.length === 0) return null;

  return (
    <div className="space-y-6 pt-8">
      <h3 className="text-sm font-medium text-on-surface-variant/60 uppercase tracking-widest">
        Resources &amp; Attachments
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {attachments.map((file) => (
          <div
            key={file.name}
            className="p-4 bg-surface-container-low rounded-lg ghost hover:bg-surface-container/50 transition-all group cursor-pointer flex items-center gap-4"
          >
            <div className="w-12 h-12 bg-surface-container-high rounded-lg flex items-center justify-center text-secondary">
              <Icon name={file.icon} size={20} />
            </div>
            <div>
              <p className="text-sm font-medium text-on-surface group-hover:text-secondary transition-colors">
                {file.name}
              </p>
              <p className="text-xs text-on-surface-variant">
                {file.size} &bull; {file.type}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
