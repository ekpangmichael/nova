function PulseBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-md bg-surface-container-lowest/50 ${className}`} />;
}

export default function DashboardLoading() {
  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="space-y-3">
            <PulseBlock className="h-3 w-24" />
            <div className="flex items-end gap-3">
              <PulseBlock className="h-12 w-24" />
              <PulseBlock className="mb-1 h-3 w-20" />
            </div>
          </div>
        ))}
      </div>

      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PulseBlock className="h-5 w-1 rounded-full" />
            <PulseBlock className="h-4 w-36" />
            <PulseBlock className="h-5 w-16 rounded-full" />
          </div>
          <PulseBlock className="h-3 w-14" />
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-lg border border-outline-variant/[0.08] bg-surface-container"
            >
              <PulseBlock className="h-px w-full rounded-none" />
              <div className="space-y-4 p-5">
                <div className="flex items-start justify-between">
                  <PulseBlock className="h-3 w-20" />
                  <PulseBlock className="h-4 w-4" />
                </div>
                <PulseBlock className="h-5 w-40" />
                <PulseBlock className="h-2 w-full rounded-full" />
                <div className="flex justify-between">
                  <PulseBlock className="h-3 w-24" />
                  <PulseBlock className="h-3 w-10" />
                </div>
              </div>
              <div className="space-y-2 bg-surface-container-lowest/60 p-4">
                {Array.from({ length: 4 }).map((__, lineIndex) => (
                  <PulseBlock key={lineIndex} className="h-3 w-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PulseBlock className="h-5 w-1 rounded-full" />
            <PulseBlock className="h-4 w-28" />
          </div>
          <PulseBlock className="h-3 w-14" />
        </div>
        <div className="overflow-hidden rounded-lg bg-surface-container-lowest/40">
          <div className="divide-y divide-outline-variant/[0.04]">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex items-center gap-4 px-5 py-3.5">
                <PulseBlock className="h-4 w-4 rounded-full" />
                <PulseBlock className="h-3 w-14" />
                <PulseBlock className="h-5 w-16 rounded-sm" />
                <PulseBlock className="h-3 flex-1" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
