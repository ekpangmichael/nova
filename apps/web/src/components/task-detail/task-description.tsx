export function TaskDescription({ paragraphs }: { paragraphs: string[] }) {
  return (
    <div className="rounded-xl bg-surface-container-low ghost px-5 py-4">
      <h3 className="mb-3 text-[12px] font-semibold tracking-tight text-on-surface">
        Description
      </h3>
      <div className="space-y-2.5 text-[13px] leading-relaxed text-on-surface-variant/50">
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </div>
  );
}
