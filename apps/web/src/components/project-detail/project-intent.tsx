export function ProjectIntent({ description }: { description: string }) {
  return (
    <section className="bg-surface-container p-6 ghost anim-3">
      <h3 className="text-[11px] font-bold tracking-widest uppercase text-on-surface-variant/60 mb-4">
        Project Intent
      </h3>
      <p className="text-[15px] text-on-surface/70 leading-relaxed">
        {description}
      </p>
    </section>
  );
}
