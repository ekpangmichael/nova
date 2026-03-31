const featuredCategories = [
  {
    name: "Cases & Covers",
    description: "Slim, rugged, and MagSafe-ready protection for the latest devices.",
  },
  {
    name: "Chargers & Cables",
    description: "Fast, dependable power gear for desks, cars, and everyday carry.",
  },
  {
    name: "Audio & Mounts",
    description: "Wireless earbuds, stands, and mounts built for life on the move.",
  },
];

const highlights = [
  "Premium phone accessories curated for everyday performance",
  "Fast shipping and easy returns on top-rated essentials",
  "Trusted compatibility for iPhone, Samsung, Pixel, and more",
];

const stats = [
  { value: "25K+", label: "orders delivered" },
  { value: "4.9/5", label: "average customer rating" },
  { value: "48h", label: "dispatch on featured items" },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(43,108,255,0.16),_transparent_38%),linear-gradient(180deg,_#07111f_0%,_#0b1526_42%,_#0f172a_100%)] text-white">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.08)_0%,transparent_26%,transparent_74%,rgba(255,153,51,0.12)_100%)]" />
        <div className="absolute left-[-10%] top-24 h-72 w-72 rounded-full bg-[#2f6bff]/30 blur-3xl" />
        <div className="absolute right-[-6%] top-40 h-64 w-64 rounded-full bg-[#ff8a1f]/20 blur-3xl" />

        <div className="relative mx-auto flex max-w-7xl flex-col px-6 pb-20 pt-8 sm:px-10 lg:px-12">
          <header className="mb-16 flex items-center justify-between rounded-full border border-white/10 bg-white/5 px-5 py-3 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2f6bff] text-lg font-black text-white shadow-[0_0_30px_rgba(47,107,255,0.35)]">
                O
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.32em] text-white/60">Orbit Shop</p>
                <p className="text-xs text-white/50">Phone accessories that actually keep up.</p>
              </div>
            </div>
            <nav className="hidden items-center gap-8 text-sm text-white/75 md:flex">
              <a href="#shop" className="transition hover:text-white">Shop</a>
              <a href="#why-orbit" className="transition hover:text-white">Why Orbit</a>
              <a href="#featured" className="transition hover:text-white">Featured</a>
            </nav>
          </header>

          <div className="grid items-center gap-16 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="max-w-2xl">
              <span className="mb-6 inline-flex rounded-full border border-[#ff8a1f]/40 bg-[#ff8a1f]/12 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-[#ffb26a]">
                Blue-first brand, orange-powered accents
              </span>
              <h1 className="text-5xl font-black leading-tight tracking-tight text-white sm:text-6xl lg:text-7xl">
                Accessories that keep your phone charged, protected, and ready for orbit.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300 sm:text-xl">
                Orbit Shop is a modern ecommerce destination for premium phone accessories—from fast chargers and durable cases to mounts, cables, and wireless audio.
              </p>

              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <a
                  href="#featured"
                  className="inline-flex items-center justify-center rounded-full bg-[#2f6bff] px-7 py-4 text-sm font-semibold text-white shadow-[0_12px_40px_rgba(47,107,255,0.38)] transition hover:bg-[#2459d8]"
                >
                  Shop best sellers
                </a>
                <a
                  href="#why-orbit"
                  className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-7 py-4 text-sm font-semibold text-white transition hover:border-[#ff8a1f]/60 hover:bg-[#ff8a1f]/10"
                >
                  Explore the brand
                </a>
              </div>

              <ul className="mt-10 space-y-4">
                {highlights.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-slate-200 sm:text-base">
                    <span className="mt-1 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[#ff8a1f] text-xs font-black text-slate-950">
                      ✓
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative">
              <div className="absolute inset-0 rounded-[2rem] bg-[linear-gradient(180deg,rgba(47,107,255,0.35),rgba(255,138,31,0.15))] blur-2xl" />
              <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/65 p-6 shadow-2xl backdrop-blur-xl">
                <div className="flex items-center justify-between border-b border-white/10 pb-5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-[#8bb0ff]">Featured drop</p>
                    <h2 className="mt-2 text-2xl font-bold text-white">MagSafe Everyday Kit</h2>
                  </div>
                  <span className="rounded-full bg-[#ff8a1f]/15 px-3 py-1 text-xs font-semibold text-[#ffb26a]">
                    New arrival
                  </span>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[1.5rem] border border-[#2f6bff]/30 bg-[linear-gradient(180deg,rgba(47,107,255,0.18),rgba(15,23,42,0.6))] p-5">
                    <p className="text-sm text-slate-300">Wireless Charger</p>
                    <p className="mt-10 text-3xl font-black text-white">15W</p>
                    <p className="mt-2 text-sm text-slate-400">Fast magnetic alignment with desk-friendly style.</p>
                  </div>
                  <div className="rounded-[1.5rem] border border-[#ff8a1f]/30 bg-[linear-gradient(180deg,rgba(255,138,31,0.18),rgba(15,23,42,0.6))] p-5">
                    <p className="text-sm text-slate-300">Protective Case</p>
                    <p className="mt-10 text-3xl font-black text-white">Drop+ </p>
                    <p className="mt-2 text-sm text-slate-400">Orange accent bumpers with premium shock absorption.</p>
                  </div>
                </div>

                <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-sm uppercase tracking-[0.24em] text-white/45">Bundle price</p>
                      <p className="mt-2 text-4xl font-black text-white">$79</p>
                    </div>
                    <div className="text-right text-sm text-slate-300">
                      <p>Save 18% today</p>
                      <p className="text-[#ffb26a]">Free shipping over $50</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="why-orbit" className="mx-auto max-w-7xl px-6 py-8 sm:px-10 lg:px-12">
        <div className="grid gap-5 rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur md:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-[1.5rem] border border-white/8 bg-slate-950/45 p-6">
              <p className="text-4xl font-black text-white">{stat.value}</p>
              <p className="mt-2 text-sm uppercase tracking-[0.24em] text-slate-400">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="shop" className="mx-auto max-w-7xl px-6 py-20 sm:px-10 lg:px-12">
        <div className="mb-10 max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#8bb0ff]">Shop by category</p>
          <h2 className="mt-4 text-3xl font-black text-white sm:text-4xl">Built for devices that never sit still.</h2>
          <p className="mt-4 text-base leading-7 text-slate-300">
            From workday essentials to travel-ready gear, Orbit Shop helps customers upgrade the way they power, protect, and carry their phones.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {featuredCategories.map((category, index) => (
            <article
              key={category.name}
              className="group rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(15,23,42,0.75))] p-6 transition hover:-translate-y-1 hover:border-[#2f6bff]/40 hover:shadow-[0_20px_50px_rgba(47,107,255,0.14)]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/8 text-lg font-black text-white">
                0{index + 1}
              </div>
              <h3 className="mt-6 text-2xl font-bold text-white">{category.name}</h3>
              <p className="mt-3 leading-7 text-slate-300">{category.description}</p>
              <div className="mt-8 h-1.5 w-full rounded-full bg-white/10">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${72 + index * 10}%`,
                    background: index === 1 ? "#ff8a1f" : "#2f6bff",
                  }}
                />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="featured" className="mx-auto max-w-7xl px-6 pb-24 sm:px-10 lg:px-12">
        <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(47,107,255,0.16),rgba(255,138,31,0.12))] p-8 sm:p-10">
          <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#ffb26a]">Launch-ready landing page concept</p>
              <h2 className="mt-4 text-3xl font-black text-white sm:text-4xl">
                Blue drives trust. Orange adds energy. Orbit Shop gets a storefront with lift-off.
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200">
                This concept uses a confident blue foundation for clarity and reliability, while orange is used sparingly as the secondary accent for promotions, calls to action, and key product highlights.
              </p>
            </div>
            <a
              href="#"
              className="inline-flex items-center justify-center rounded-full bg-[#ff8a1f] px-7 py-4 text-sm font-semibold text-slate-950 transition hover:bg-[#ff9f45]"
            >
              Launch collection
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
