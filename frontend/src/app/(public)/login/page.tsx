"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useAuth } from "@/hooks/use-auth";

export default function LoginPage() {
  const { login, loading, error, clearError } = useAuth();
  const [form, setForm] = useState({ username: "", password: "" });
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError(null);
    clearError();
    if (!form.username || !form.password) {
      setLocalError("Ingresa tu usuario y contraseña.");
      return;
    }
    try {
      await login(form);
    } catch {
      setLocalError("Credenciales inválidas. Verifica e inténtalo nuevamente.");
    }
  };

  return (
    <div className="hover-glow mx-auto flex w-full max-w-lg flex-col gap-8 rounded-3xl border border-neutral-200 bg-(--surface) px-6 py-10 shadow-(--shadow-card) sm:px-10">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold text-(--foreground)">
          Hola de nuevo
        </h1>
        <p className="text-sm text-(--muted-foreground)">
          Ingresa para gestionar tus locales o seguir tus pedidos en Coffeefy.
        </p>
      </div>
      {(localError || error) && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {localError ?? error}
        </div>
      )}
      <form className="space-y-6" onSubmit={handleSubmit}>
        <label className="block space-y-2 text-sm font-medium text-(--foreground)">
          Usuario
          <input
            name="username"
            value={form.username}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, username: event.target.value }))
            }
            placeholder="barista23"
            className="w-full rounded-xl border border-white/60 bg-(--surface) px-4 py-3 text-sm text-(--foreground) shadow-sm transition-colors focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/30 dark:border-white/20"
            autoComplete="username"
          />
        </label>
        <label className="block space-y-2 text-sm font-medium text-(--foreground)">
          Contraseña
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, password: event.target.value }))
            }
            placeholder="••••••••"
            className="w-full rounded-xl border border-white/60 bg-(--surface) px-4 py-3 text-sm text-(--foreground) shadow-sm transition-colors focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/30 dark:border-white/20"
            autoComplete="current-password"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-(--accent) px-6 py-3 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 hover:bg-(--accent-dark) disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Ingresando…" : "Ingresar"}
        </button>
      </form>
      <p className="text-center text-sm text-(--muted-foreground)">
        ¿No tienes cuenta?{" "}
        <Link href="/register" className="font-semibold text-(--accent)">
          Regístrate gratis
        </Link>
      </p>
    </div>
  );
}
