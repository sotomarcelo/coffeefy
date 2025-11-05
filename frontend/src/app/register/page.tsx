"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useAuth } from "@/hooks/use-auth";

const roles = [
  { value: "cliente", label: "Coffee Lover" },
  { value: "cafeteria", label: "Cafetería" },
  { value: "tostaduria", label: "Tostaduría" },
  { value: "hibrido", label: "Híbrido" },
];

export default function RegisterPage() {
  const { register, loading, error, clearError } = useAuth();
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    role: "cliente",
  });
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearError();
    setLocalError(null);
    if (!form.username || !form.password) {
      setLocalError("Completa usuario y contraseña.");
      return;
    }
    try {
      await register(form);
    } catch {
      setLocalError(
        "No pudimos crear tu cuenta. Revisa los datos y vuelve a intentar."
      );
    }
  };

  return (
    <div className="hover-glow mx-auto flex w-full max-w-xl flex-col gap-8 rounded-3xl border border-neutral-200 bg-(--surface) px-6 py-10 shadow-(--shadow-card) sm:px-10">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold text-(--foreground)">
          Crea tu cuenta Coffeefy
        </h1>
        <p className="text-sm text-(--muted-foreground)">
          En menos de dos minutos podrás comenzar a cargar productos y
          recompensas.
        </p>
      </div>
      {(localError || error) && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {localError ?? error}
        </div>
      )}
      <form className="space-y-5" onSubmit={handleSubmit}>
        <label className="block space-y-2 text-sm font-medium text-(--foreground)">
          Usuario
          <input
            name="username"
            value={form.username}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, username: event.target.value }))
            }
            placeholder="cafeteria-el-abuelo"
            className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-(--foreground) shadow-sm focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
            autoComplete="username"
          />
        </label>
        <label className="block space-y-2 text-sm font-medium text-(--foreground)">
          Email (opcional)
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, email: event.target.value }))
            }
            placeholder="equipo@coffeefy.app"
            className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-(--foreground) shadow-sm focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
            autoComplete="email"
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
            className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-(--foreground) shadow-sm focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
            autoComplete="new-password"
          />
        </label>
        <label className="block space-y-2 text-sm font-medium text-(--foreground)">
          Tipo de cuenta
          <select
            name="role"
            value={form.role}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, role: event.target.value }))
            }
            className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-(--foreground) shadow-sm focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
          >
            {roles.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-(--accent) px-6 py-3 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 hover:bg-(--accent-dark) disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Creando cuenta…" : "Crear cuenta"}
        </button>
      </form>
      <p className="text-center text-sm text-(--muted-foreground)">
        ¿Ya estás registrado?{" "}
        <Link href="/login" className="font-semibold text-(--accent)">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
