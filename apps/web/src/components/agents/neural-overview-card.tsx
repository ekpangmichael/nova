"use client";

export function NeuralOverviewCard() {
  const bars = [50, 33, 66, 25, 75, 50];

  return (
    <div className="lg:col-span-2 bg-surface-container-low p-10 flex flex-col md:flex-row gap-12 rounded-lg relative overflow-hidden group">
      {/* Text content */}
      <div className="flex-1 flex flex-col gap-6 z-10">
        <div>
          <span className="text-[10px] uppercase tracking-[0.3em] text-secondary/60 font-semibold block mb-4">
            Neural Overview
          </span>
          <h3 className="text-2xl font-light text-on-surface leading-tight">
            Global Connectivity
            <br />
            &amp; Signal Strength
          </h3>
        </div>
        <p className="text-on-surface-variant text-sm font-light leading-relaxed max-w-sm">
          System stability is at 99.98%. Latency between regional agents
          remains sub-5ms across all major oceanic fiber backbones.
        </p>
        <div className="flex gap-8 mt-4">
          <div>
            <span className="text-2xl font-light text-on-surface">24ms</span>
            <p className="text-[9px] uppercase tracking-widest text-on-surface-variant">
              Avg Latency
            </p>
          </div>
          <div>
            <span className="text-2xl font-light text-on-surface">1.2TB</span>
            <p className="text-[9px] uppercase tracking-widest text-on-surface-variant">
              Data Flux
            </p>
          </div>
        </div>
      </div>

      {/* Animated bar chart */}
      <div className="flex-1 flex items-center justify-center min-h-[200px] z-10">
        <div className="w-full h-full flex items-end gap-2 px-4">
          {bars.map((h, i) => (
            <div
              key={i}
              className="flex-1 bg-secondary/10 group-hover:bg-secondary/25 transition-all duration-700"
              style={{
                height: `${h}%`,
                transitionDelay: `${i * 100}ms`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
