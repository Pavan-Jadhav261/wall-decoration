import Link from "next/link";

export default function Home() {
  return (
    <main className="lovable-surface relative min-h-screen overflow-hidden text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.12),transparent_46%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(0,0,0,0.38),transparent)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-[linear-gradient(0deg,rgba(13,18,30,0.36),transparent)]" />

      <section className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1500px] flex-col px-4 pb-10 pt-4 sm:px-6 md:px-10">
        <header className="glass-panel rounded-2xl px-4 py-3 md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="inline-block h-3.5 w-6 rounded-[999px] bg-[linear-gradient(90deg,#ff6b4a,#ff2da8,#5f9dff)]" />
              <span className="text-2xl font-semibold">Wallable</span>
            </div>
            <nav className="hidden items-center gap-7 text-sm font-medium text-slate-200/90 lg:flex">
              <Link href="/">Solutions</Link>
              <Link href="/">Resources</Link>
              <Link href="/">Community</Link>
              <Link href="/">Pricing</Link>
            </nav>
            <div className="flex items-center gap-2">
              <Link href="/auth" className="btn-ghost rounded-xl px-4 py-2 text-sm font-medium">
                Log in
              </Link>
              <Link href="/auth" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900">
                Get started
              </Link>
            </div>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center pt-16 text-center md:pt-20">
          <h1 className="max-w-4xl text-4xl font-bold leading-tight sm:text-5xl md:text-7xl">
            Build a Lovable Wall Redesign
          </h1>
          <p className="mt-4 max-w-2xl text-lg font-medium text-slate-200/75">
            Create wall decoration concepts by chatting with AI and comparing before and after previews.
          </p>

          <div className="glass-panel mt-10 w-full rounded-[2rem] p-4 shadow-[0_40px_100px_rgba(14,18,30,0.45)] sm:p-6">
            <div className="rounded-[1.5rem] border border-white/10 bg-[#181c27]/92 px-5 py-5 text-left sm:px-6 sm:py-6">
              <p className="text-xl font-semibold text-slate-300/90">
                Ask Wallable to decorate my living room wall with modern shelving under INR 50,000...
              </p>
              <div className="mt-8 flex items-center justify-between text-slate-400">
                <button
                  type="button"
                  className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/5 text-xl"
                  aria-label="Add attachment"
                >
                  +
                </button>
                <div className="flex items-center gap-4 text-sm">
                  <span className="rounded-full border border-white/15 px-3 py-1">Decorate</span>
                  <button
                    type="button"
                    className="grid h-10 w-10 place-items-center rounded-full bg-white text-slate-900"
                    aria-label="Submit prompt"
                  >
                    ↑
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm">
            <Link href="/decorate" className="btn-primary rounded-full px-5 py-2.5 font-semibold">
              Open Decorate Studio
            </Link>
            <Link href="/auth" className="btn-ghost rounded-full px-5 py-2.5 font-semibold">
              Login / Signup
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
