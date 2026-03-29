export function TaskDescription({ paragraphs }: { paragraphs: string[] }) {
  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium text-on-surface-variant/60 uppercase tracking-widest">
        Description
      </h3>
      <div className="space-y-4 text-on-surface-variant leading-relaxed text-lg">
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </div>
  );
}
