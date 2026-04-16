import { Icon } from "@/components/ui/icon";
import type { TaskAttachment } from "@/types";

export function TaskAttachments({ attachments }: { attachments: TaskAttachment[] }) {
  if (attachments.length === 0) return null;

  return (
    <div className="space-y-6 pt-8">
      <h3 className="text-sm font-medium text-on-surface-variant/60 uppercase tracking-widest">
        Resources &amp; Attachments
      </h3>
      <div className="flex flex-wrap gap-3">
        {attachments.map((file) => (
          <a
            key={file.id}
            href={file.contentUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-4 rounded-lg bg-surface-container-low p-4 text-on-surface transition-all hover:bg-surface-container/50"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface-container-high text-secondary">
              <Icon name={file.icon} size={20} />
            </div>
            <div>
              <p className="text-sm font-medium transition-colors hover:text-secondary">
                {file.name}
              </p>
              <p className="text-xs text-on-surface-variant">
                {file.size} &bull; {file.type}
              </p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
