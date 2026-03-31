export function TaskDescription({ paragraphs }: { paragraphs: string[] }) {
  return (
    <div className="space-y-3">
      <h3 className="text-[11px] font-bold text-on-surface-variant/50 uppercase tracking-widest">
        Description
      </h3>
      <div className="space-y-3 text-on-surface-variant leading-relaxed text-sm">
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </div>
  );
}
