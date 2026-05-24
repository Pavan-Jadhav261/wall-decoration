"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "login" | "signup";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      if (!email || !password) {
        setError("Email and password are required.");
        return;
      }
      if (mode === "signup" && !name.trim()) {
        setError("Name is required for sign up.");
        return;
      }

      const usersRaw = localStorage.getItem("dummy_users");
      const users = usersRaw ? (JSON.parse(usersRaw) as Array<{ name: string; email: string; password: string }>) : [];
      const normalizedEmail = email.trim().toLowerCase();

      if (mode === "signup") {
        const alreadyExists = users.some((user) => user.email === normalizedEmail);
        if (alreadyExists) {
          setError("Email already exists. Please login.");
          return;
        }
        users.push({ name: name.trim(), email: normalizedEmail, password });
        localStorage.setItem("dummy_users", JSON.stringify(users));
        localStorage.setItem(
          "dummy_session_user",
          JSON.stringify({ name: name.trim(), email: normalizedEmail }),
        );
        setMessage("Sign up successful.");
      } else {
        const existingUser = users.find(
          (user) => user.email === normalizedEmail && user.password === password,
        );
        if (!existingUser) {
          setError("Invalid credentials.");
          return;
        }
        localStorage.setItem(
          "dummy_session_user",
          JSON.stringify({ name: existingUser.name, email: existingUser.email }),
        );
        setMessage("Login successful.");
      }

      router.push("/decorate");
      router.refresh();
    } catch {
      setError("Something went wrong. Please retry.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="lovable-surface relative min-h-screen overflow-hidden px-4 py-8 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.4),transparent_25%,transparent_80%,rgba(0,0,0,0.35))]" />
      <section className="relative z-10 mx-auto w-full max-w-md rounded-[2rem] border border-white/15 bg-[#131825]/70 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur-2xl md:p-8">
        <h1 className="text-3xl font-bold text-slate-100">Welcome back</h1>
        <p className="mt-2 text-sm text-slate-300/85">
          Login or create your account to start decorating walls with AI.
        </p>

        <div className="mt-6 grid grid-cols-2 rounded-full border border-white/20 bg-white/5 p-1">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              mode === "login"
                ? "bg-white text-slate-900"
                : "text-slate-300 hover:bg-white/10"
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              mode === "signup"
                ? "bg-white text-slate-900"
                : "text-slate-300 hover:bg-white/10"
            }`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {mode === "signup" && (
            <div>
              <label htmlFor="name" className="mb-1 block text-sm font-medium text-slate-200">
                Full Name
              </label>
              <input
                id="name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-xl border border-white/20 bg-black/20 px-3 py-2 text-slate-100 placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/65"
              />
            </div>
          )}
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-200">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-white/20 bg-black/20 px-3 py-2 text-slate-100 placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/65"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-200">
              Password
            </label>
            <input
              id="password"
              type="password"
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-white/20 bg-black/20 px-3 py-2 text-slate-100 placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/65"
            />
          </div>

          {error && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          )}
          {message && (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-white px-4 py-2.5 font-semibold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-65 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
          >
            {loading ? "Please wait..." : mode === "login" ? "Login" : "Create account"}
          </button>
        </form>
      </section>
    </main>
  );
}
