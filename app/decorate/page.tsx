"use client";

import { FormEvent, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { BeforeAfterComparison } from "@/components/before-after-comparison";

type DecorateResult = {
  originalImage: string;
  generatedImage: string;
  promptSummary: string;
};

type SessionUser = {
  name: string;
  email: string;
};

const styleOptions = ["Modern Minimal", "Scandinavian", "Boho Chic", "Contemporary Luxe"];
const roomOptions = ["Living Room", "Bedroom", "Dining Area", "Office Corner"];
const colorOptions = ["Warm neutrals + teal", "Earthy + wood tones", "Soft pastel mix", "Black + white contrast"];
const decorChoices = ["Framed art", "Wall shelves", "Pendant lights", "Mirrors", "Planters"];
let cachedUserRaw: string | null = null;
let cachedUserSnapshot: SessionUser | null = null;

function subscribeBrowserStorage(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handler = () => onStoreChange();
  window.addEventListener("storage", handler);
  window.addEventListener("themechange", handler as EventListener);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener("themechange", handler as EventListener);
  };
}

function getThemeSnapshot(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  const dataTheme = document.documentElement.dataset.theme;
  if (dataTheme === "light") return "light";
  if (dataTheme === "dark") return "dark";
  return localStorage.getItem("theme_mode") === "light" ? "light" : "dark";
}

function getUserSnapshot() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("dummy_session_user");
  if (raw === cachedUserRaw) {
    return cachedUserSnapshot;
  }
  cachedUserRaw = raw;
  cachedUserSnapshot = raw ? (JSON.parse(raw) as SessionUser) : null;
  return cachedUserSnapshot;
}

function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeBrowserStorage, getThemeSnapshot, () => "dark");

  function changeTheme(next: "light" | "dark") {
    localStorage.setItem("theme_mode", next);
    document.documentElement.dataset.theme = next;
    window.dispatchEvent(new Event("themechange"));
  }

  return (
    <div className="inline-flex rounded-full border border-white/20 bg-black/20 p-1">
      <button
        type="button"
        onClick={() => changeTheme("light")}
        className={`rounded-full px-3 py-1 text-xs font-semibold ${
          theme === "light" ? "bg-white text-slate-900" : "text-slate-200"
        }`}
      >
        Light
      </button>
      <button
        type="button"
        onClick={() => changeTheme("dark")}
        className={`rounded-full px-3 py-1 text-xs font-semibold ${
          theme === "dark" ? "bg-white text-slate-900" : "text-slate-200"
        }`}
      >
        Dark
      </button>
    </div>
  );
}

export default function DecoratePage() {
  const router = useRouter();
  const user = useSyncExternalStore(subscribeBrowserStorage, getUserSnapshot, () => null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<DecorateResult | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [style, setStyle] = useState(styleOptions[0]);
  const [roomType, setRoomType] = useState(roomOptions[0]);
  const [colorPalette, setColorPalette] = useState(colorOptions[0]);
  const [selectedDecor, setSelectedDecor] = useState<string[]>(["Framed art", "Wall shelves"]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!user) {
      router.replace("/auth");
    }
  }, [router, user]);

  const mustHaveItems = useMemo(() => selectedDecor.join(", "), [selectedDecor]);

  function toggleDecorChoice(item: string) {
    setSelectedDecor((prev) =>
      prev.includes(item) ? prev.filter((value) => value !== item) : [...prev, item],
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);
    if (!image) {
      setError("Please upload a wall image first.");
      return;
    }

    setSubmitting(true);
    try {
      const form = new FormData();
      form.set("image", image);
      form.set("style", style);
      form.set("roomType", roomType);
      form.set("colorPalette", colorPalette);
      form.set("mustHaveItems", mustHaveItems);
      form.set("notes", notes);

      const response = await fetch("/api/decorate", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "Decoration failed.");
        return;
      }
      setResult(data);
    } catch {
      setError("Something went wrong while generating the decorated wall.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("dummy_session_user");
    router.replace("/auth");
    router.refresh();
  }

  if (!user) {
    return <main className="grid min-h-screen place-items-center text-slate-700 dark:text-slate-200">Checking session...</main>;
  }

  return (
    <main className="lovable-surface min-h-screen text-slate-900 dark:text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.25),transparent_42%),radial-gradient(circle_at_80%_90%,rgba(255,255,255,0.12),transparent_40%)]" />
      <div className="mx-auto flex h-screen w-full max-w-[1500px] flex-col">
        <header className="glass-panel mx-3 mt-3 flex items-center justify-between rounded-2xl border-white/45 bg-white/34 px-4 py-3 shadow-[0_14px_50px_rgba(12,20,35,0.22)] dark:border-white/12 dark:bg-black/24">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Wall Decorator Studio</h1>
            <p className="text-xs text-slate-700 dark:text-slate-300">Hi {user.name}, build your new wall concept</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button onClick={handleLogout} className="btn-ghost rounded-lg px-3 py-1.5 text-sm">
              Logout
            </button>
          </div>
        </header>

        <div className="grid flex-1 gap-3 overflow-hidden px-3 pb-3 pt-3 md:grid-cols-[420px_1fr]">
          <aside className="glass-panel overflow-y-auto rounded-2xl border-white/40 bg-white/26 p-4 shadow-[0_12px_45px_rgba(15,23,42,0.2)] dark:border-white/12 dark:bg-black/20">
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label htmlFor="image" className="mb-1 block text-sm font-medium text-slate-800 dark:text-slate-100">Upload wall image</label>
                <input
                  id="image"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  required
                  onChange={(event) => setImage(event.target.files?.[0] ?? null)}
                  className="w-full rounded-lg border border-slate-300/70 bg-white/58 p-2 text-sm text-slate-800 file:rounded-md file:border-0 file:bg-white/80 file:px-2 file:py-1 file:text-slate-800 dark:border-white/20 dark:bg-black/20 dark:text-slate-200 dark:file:bg-white/15 dark:file:text-slate-100"
                />
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-slate-800 dark:text-slate-100">Style</p>
                <div className="grid grid-cols-2 gap-2">
                  {styleOptions.map((option) => (
                    <button
                      type="button"
                      key={option}
                      onClick={() => setStyle(option)}
                      className={`rounded-lg border px-3 py-2 text-sm ${
                        style === option
                          ? "border-cyan-400/65 bg-cyan-300/25 text-cyan-900 dark:text-cyan-100"
                          : "border-slate-300 text-slate-700 dark:border-white/20 dark:text-slate-300"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-slate-800 dark:text-slate-100">Room type</p>
                <div className="grid grid-cols-2 gap-2">
                  {roomOptions.map((option) => (
                    <button
                      type="button"
                      key={option}
                      onClick={() => setRoomType(option)}
                      className={`rounded-lg border px-3 py-2 text-sm ${
                        roomType === option
                          ? "border-cyan-400/65 bg-cyan-300/25 text-cyan-900 dark:text-cyan-100"
                          : "border-slate-300 text-slate-700 dark:border-white/20 dark:text-slate-300"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-slate-800 dark:text-slate-100">Color palette</p>
                <div className="grid gap-2">
                  {colorOptions.map((option) => (
                    <button
                      type="button"
                      key={option}
                      onClick={() => setColorPalette(option)}
                      className={`rounded-lg border px-3 py-2 text-left text-sm ${
                        colorPalette === option
                          ? "border-cyan-400/65 bg-cyan-300/25 text-cyan-900 dark:text-cyan-100"
                          : "border-slate-300 text-slate-700 dark:border-white/20 dark:text-slate-300"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-slate-800 dark:text-slate-100">Must-have decor (multi-select)</p>
                <div className="flex flex-wrap gap-2">
                  {decorChoices.map((item) => {
                    const active = selectedDecor.includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => toggleDecorChoice(item)}
                        className={`rounded-full border px-3 py-1.5 text-xs ${
                          active
                            ? "border-cyan-400/65 bg-cyan-300/25 text-cyan-900 dark:text-cyan-100"
                            : "border-slate-300 text-slate-700 dark:border-white/20 dark:text-slate-300"
                        }`}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label htmlFor="notes" className="mb-1 block text-sm font-medium text-slate-800 dark:text-slate-100">Additional notes</label>
                <textarea
                  id="notes"
                  rows={3}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="w-full rounded-lg border border-slate-300/70 bg-white/58 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-500 dark:border-white/20 dark:bg-black/20 dark:text-slate-200 dark:placeholder:text-slate-400"
                />
              </div>

              {error && <p className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-300/50 dark:bg-rose-500/15 dark:text-rose-100">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
              >
                {submitting ? "Generating..." : "Generate Decorated Wall"}
              </button>
            </form>
          </aside>

          <section className="glass-panel overflow-y-auto rounded-2xl border-white/40 bg-white/26 p-4 shadow-[0_12px_45px_rgba(15,23,42,0.2)] dark:border-white/12 dark:bg-black/20">
            <div className="mx-auto w-full max-w-4xl space-y-4">
              <div className="rounded-2xl border border-slate-300/60 bg-white/50 p-4 dark:border-white/15 dark:bg-black/24">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">Assistant</p>
                <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                  Upload your wall and select your design options. I will generate a decorated version and show before/after.
                </p>
              </div>

              {!result ? (
                <div className="rounded-2xl border border-dashed border-slate-300/85 bg-white/36 p-10 text-center text-sm text-slate-700 dark:border-white/25 dark:bg-black/15 dark:text-slate-200">
                  Your generated result will appear here.
                </div>
              ) : (
                <div className="space-y-3 rounded-2xl border border-slate-300/80 bg-white/36 p-4 dark:border-white/15 dark:bg-black/15">
                  <BeforeAfterComparison beforeSrc={result.originalImage} afterSrc={result.generatedImage} />
                  <div className="rounded-lg border border-slate-300/70 bg-white/55 p-3 text-sm text-slate-800 dark:border-white/10 dark:bg-black/25 dark:text-slate-100">
                    {result.promptSummary}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
