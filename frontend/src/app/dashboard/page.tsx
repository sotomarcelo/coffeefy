"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { Reveal } from "@/components/reveal";

const quickLinks = [
  {
    href: "/dashboard/productos",
    label: "Catálogo",
    description: "Gestiona bebidas y granos",
  },
  {
    href: "/dashboard/pedidos",
    label: "Pedidos",
    description: "Supervisa pedidos y estados",
  },
  {
    href: "/dashboard/puntos",
    label: "Lealtad",
    description: "Administra puntos y recompensas",
  },
];

const metrics = [
  {
    title: "Ventas estimadas",
    value: "$12.4K",
    delta: "+18% semana",
  },
  {
    title: "Pedidos activos",
    value: "27",
    delta: "4 urgentes",
  },
  {
    title: "Lealtad",
    value: "1.8K pts",
    delta: "112 canjes",
  },
];

const revealDelay = (index: number) => ({
  ["--reveal-delay" as string]: `${index * 120}ms`,
});

export default function DashboardPage() {
  const { user, logout } = useAuth();

  if (!user) {
    return (
      <Reveal className="mx-auto flex w-full max-w-3xl flex-col gap-6 rounded-3xl border border-neutral-200 bg-(--surface) px-6 py-10 text-center shadow-(--shadow-card) sm:px-12">
        <h1 className="text-3xl font-semibold text-(--foreground)">
          Necesitas iniciar sesión
        </h1>
        <p className="text-neutral-600">
          Para acceder al panel Coffeefy primero debes iniciar sesión o crear
          una cuenta.
        </p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/login"
            className="rounded-full bg-(--accent) px-6 py-3 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 hover:bg-(--accent-dark)"
          >
            Ir a iniciar sesión
          </Link>
          <Link
            href="/register"
            className="rounded-full border border-neutral-200 px-6 py-3 text-sm font-semibold text-(--foreground) transition-all hover:-translate-y-0.5 hover:border-(--accent)"
          >
            Crear cuenta
          </Link>
        </div>
      </Reveal>
    );
  }

  return (
    <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-10 sm:px-6">
      <Reveal className="hero-card rounded-3xl border border-neutral-200 bg-(--surface) px-6 py-10 shadow-(--shadow-card) sm:px-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-(--foreground)">
              Bienvenido, {user.username}
            </h1>
            <p className="mt-2 max-w-xl text-(--muted-foreground)">
              Supervisa tus locales, responde pedidos en tiempo real y fideliza
              a tus clientes con experiencias memorables.
            </p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="self-start rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-(--foreground) transition-all hover:-translate-y-0.5 hover:border-(--accent)"
          >
            Cerrar sesión
          </button>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {metrics.map((card) => (
            <div
              key={card.title}
              className="floating-card rounded-2xl border border-white/60 bg-white/40 p-5 text-(--muted-foreground-strong) shadow-(--shadow-card) backdrop-blur-sm dark:border-white/10 dark:bg-white/5"
            >
              <p className="text-xs uppercase tracking-wide text-(--muted-foreground)">
                {card.title}
              </p>
              <p className="mt-2 text-2xl font-semibold text-(--foreground)">
                {card.value}
              </p>
              <p className="text-xs font-medium text-(--accent)">
                {card.delta}
              </p>
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal className="grid gap-6 md:grid-cols-3">
        {quickLinks.map((item, index) => (
          <article
            key={item.href}
            style={revealDelay(index) as CSSProperties}
            className="group hover-glow relative overflow-hidden rounded-3xl border border-neutral-200 bg-(--surface) p-6 shadow-(--shadow-card)"
          >
            <div className="absolute inset-0 -z-10 opacity-0 transition-opacity duration-500 [background:radial-gradient(circle_at_top,rgba(200,124,64,0.12),transparent_60%)] group-hover:opacity-100" />
            <h2 className="text-xl font-semibold text-(--foreground)">
              {item.label}
            </h2>
            <p className="mt-2 text-sm text-(--muted-foreground)">
              {item.description}
            </p>
            <Link
              href={item.href}
              className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-(--accent) transition-transform hover:translate-x-1"
            >
              Abrir sección →
            </Link>
          </article>
        ))}
      </Reveal>

      <Reveal className="rounded-3xl border border-neutral-200 bg-(--surface) px-6 py-8 shadow-(--shadow-card) sm:px-10">
        <h2 className="text-2xl font-semibold text-(--foreground)">
          Siguiente sprint
        </h2>
        <ul className="mt-4 list-disc space-y-2 pl-6 text-sm text-(--muted-foreground)">
          <li>
            Conectar con el backend para listar productos y balances reales.
          </li>
          <li>
            Configurar páginas detalladas de pedidos y flujo de actualización de
            estados.
          </li>
          <li>Integrar métricas de puntos y canjes en tiempo casi real.</li>
        </ul>
      </Reveal>
    </div>
  );
}
