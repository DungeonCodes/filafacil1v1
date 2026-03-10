"use client";

import { FormEvent, useState } from "react";

type LoginResponse = {
  ok?: boolean;
  error?: string;
  redirectTo?: string;
};

export function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username,
          password
        })
      });

      const payload = (await response.json().catch(() => null)) as LoginResponse | null;
      if (!response.ok) {
        setErrorMessage(payload?.error ?? "Falha no login. Verifique suas credenciais.");
        setIsSubmitting(false);
        return;
      }

      window.location.assign(payload?.redirectTo ?? "/admin");
    } catch {
      setErrorMessage("Falha no login. Tente novamente.");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10">
      <section className="rounded-3xl border-4 border-slate-900 bg-white/95 p-8 shadow-xl">
        <h1 className="text-center text-4xl font-black text-slate-950">Login</h1>
        <p className="mt-3 text-center text-base font-semibold text-slate-700">
          Acesse as areas internas do FilaFacil Acessivel.
        </p>

        {errorMessage && (
          <p role="alert" className="mt-6 rounded-xl border-2 border-rose-700 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900">
            {errorMessage}
          </p>
        )}

        <form className="mt-6 space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-bold uppercase tracking-wide text-slate-700">Usuario</span>
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
              className="min-h-12 rounded-xl border-2 border-slate-800 bg-white px-3 text-base font-semibold text-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-bold uppercase tracking-wide text-slate-700">Senha</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              className="min-h-12 rounded-xl border-2 border-slate-800 bg-white px-3 text-base font-semibold text-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500"
            />
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 min-h-12 w-full rounded-xl border-2 border-slate-900 bg-slate-900 px-4 text-base font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-400 disabled:bg-slate-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500"
          >
            {isSubmitting ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </section>
    </main>
  );
}
