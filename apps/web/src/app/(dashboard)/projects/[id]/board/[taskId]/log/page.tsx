import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import {
  getRunEvents,
  getTask,
  ApiError,
  type ApiRunEvent,
} from "@/lib/api";
import {
  getRunEventDescription,
  getRunEventIcon,
  getRunEventTitle,
  formatRuntimeLabel,
} from "@/components/task-detail/task-run-events";
import { formatTimestampForDisplay } from "@/lib/display-preferences";
import { getServerDisplayPreferences } from "@/lib/display-preferences.server";

function formatPayload(payload: unknown) {
  if (payload == null) {
    return null;
  }

  return JSON.stringify(payload, null, 2);
}

function buildEventRows(events: ApiRunEvent[]) {
  return [...events]
    .filter((event) => event.eventType !== "usage")
    .reverse()
    .map((event) => ({
      ...event,
      icon: getRunEventIcon(event),
      title: getRunEventTitle(event),
      description: getRunEventDescription(event),
      payloadJson: formatPayload(event.payload),
    }));
}

export default async function TaskExecutionLogPage({
  params,
}: {
  params: Promise<{ id: string; taskId: string }>;
}) {
  const { id, taskId } = await params;

  try {
    const displayPreferences = await getServerDisplayPreferences();
    const task = await getTask(taskId);

    if (task.project.id !== id) {
      notFound();
    }

    const selectedRun = task.currentRun ?? task.recentRuns[0] ?? null;
    const runEvents = selectedRun ? await getRunEvents(selectedRun.id) : [];
    const rows = buildEventRows(runEvents);
    const runtimeLabel = formatRuntimeLabel(selectedRun?.runtimeKind);

    return (
      <div className="space-y-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-4 text-sm text-on-surface-variant">
              <Link
                href={`/projects/${id}/board/${taskId}`}
                className="flex items-center gap-1 transition-colors hover:text-on-surface"
              >
                <Icon name="arrow_back" size={16} />
                Task Detail
              </Link>
              <div className="h-4 w-px bg-outline-variant/30" />
              <span>{task.project.name}</span>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-on-surface-variant/55">
                Full Execution Log
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-on-surface">
                {task.title}
              </h1>
              <p className="mt-2 text-sm text-on-surface-variant">
                {selectedRun
                  ? `Showing attempt ${selectedRun.attemptNumber} with ${rows.length} runtime events.`
                  : "This task has no execution history yet."}
              </p>
            </div>
          </div>

          <div className="rounded-sm border border-outline-variant/20 bg-surface-container/60 px-4 py-3 text-right">
            <p className="text-[10px] uppercase tracking-[0.24em] text-on-surface-variant/45">
              Attempt
            </p>
            <p className="mt-2 text-lg font-semibold text-on-surface">
              {selectedRun ? selectedRun.attemptNumber : "None"}
            </p>
            {runtimeLabel ? (
              <p className="mt-2 inline-flex rounded-sm bg-secondary/10 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-secondary/70">
                {runtimeLabel}
              </p>
            ) : null}
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-sm border border-outline-variant/20 bg-surface-container/40 px-6 py-10 text-sm text-on-surface-variant">
            No runtime events are available for this task yet.
          </div>
        ) : (
          <div className="space-y-4">
            {rows.map((event) => (
              <div
                key={event.id}
                className="rounded-sm border border-outline-variant/20 bg-surface-container/30 px-5 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant">
                      <Icon name={event.icon} size={16} />
                    </div>
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="text-sm font-medium text-on-surface">
                          {event.title}
                        </p>
                        <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">
                          {event.eventType}
                        </span>
                        <span className="font-mono text-[11px] text-outline-variant">
                          seq {event.seq}
                        </span>
                      </div>
                      <p className="max-w-4xl whitespace-pre-wrap text-sm leading-6 text-on-surface-variant">
                        {event.description}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-outline-variant">
                    {formatTimestampForDisplay(
                      event.createdAt,
                      displayPreferences
                    )}
                  </p>
                </div>

                {event.payloadJson ? (
                  <details className="mt-4 rounded-sm border border-outline-variant/15 bg-black/20">
                    <summary className="cursor-pointer list-none px-4 py-3 text-xs uppercase tracking-[0.18em] text-on-surface-variant/70">
                      Raw Payload
                    </summary>
                    <pre className="overflow-x-auto border-t border-outline-variant/15 px-4 py-4 text-xs leading-6 text-on-surface-variant">
                      <code>{event.payloadJson}</code>
                    </pre>
                  </details>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }

    throw error;
  }
}
