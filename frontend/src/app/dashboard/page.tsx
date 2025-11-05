"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { Reveal } from "@/components/reveal";
import { ROLE_CONFIG, ROLE_LABELS, RoleKey } from "./config";

export default function DashboardPage() {
  const { user } = useAuth();

  if (!user) {
    return (
      <Reveal className="mx-auto flex w-full max-w-3xl flex-col gap-6 rounded-3xl border border-white/60 bg-(--surface) px-6 py-10 text-center shadow-(--shadow-card) sm:px-12">
        <h1 className="text-3xl font-semibold text-(--foreground)">
          Necesitas iniciar sesión
        </h1>
        <p className="text-(--muted-foreground)">
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
            className="rounded-full border border-white/60 px-6 py-3 text-sm font-semibold text-(--foreground) transition-all hover:-translate-y-0.5 hover:border-(--accent) dark:border-white/20"
          >
            Crear cuenta
          </Link>
        </div>
      </Reveal>
    );
  }

  const roleKey = (user.role as RoleKey) ?? "cliente";
  const config = ROLE_CONFIG[roleKey] ?? ROLE_CONFIG.default;
  const roleLabel = ROLE_LABELS[roleKey] ?? ROLE_LABELS.default;

  return (
    <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-12 px-2 py-6 sm:px-0">
      <Reveal className="hero-card rounded-3xl border border-white/60 bg-(--surface) px-6 py-10 shadow-(--shadow-card) sm:px-10 dark:border-white/15">
        <div className="flex flex-col gap-6">
          <span className="inline-flex items-center gap-2 self-start rounded-full bg-(--surface-alt) px-4 py-1 text-xs font-semibold uppercase tracking-wide text-(--accent)">
            {roleLabel}
          </span>
          <div>
            <h1 className="text-3xl font-semibold text-(--foreground)">
              {config.heroTitle}
            </h1>
            <p className="mt-3 max-w-2xl text-(--muted-foreground)">
              {config.heroDescription}
            </p>
          </div>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {config.metrics.map((card) => (
            <div
              key={card.title}
              className="floating-card rounded-2xl border border-white/60 bg-white/35 p-5 text-(--muted-foreground-strong) shadow-(--shadow-card) backdrop-blur-sm dark:border-white/10 dark:bg-white/5"
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
        {config.quickActions.map((action) => (
          <article
            key={action.href}
            className="group hover-glow relative overflow-hidden rounded-3xl border border-white/60 bg-(--surface) p-6 shadow-(--shadow-card) dark:border-white/15"
          >
            <div className="absolute inset-0 -z-10 opacity-0 transition-opacity duration-500 [background:radial-gradient(circle_at_top,rgba(200,124,64,0.12),transparent_60%)] group-hover:opacity-100" />
            <h2 className="text-xl font-semibold text-(--foreground)">
              {action.label}
            </h2>
            <p className="mt-3 text-sm text-(--muted-foreground)">
              {action.description}
            </p>
            <Link
              href={action.href}
              className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-(--accent) transition-transform hover:translate-x-1"
            >
              Abrir módulo →
            </Link>
          </article>
        ))}
      </Reveal>

      {config.sections.map((section) => (
        <Reveal
          key={section.id}
          as="section"
          id={`module-${section.id}`}
          className="rounded-3xl border border-white/60 bg-(--surface) px-6 py-10 shadow-(--shadow-card) scroll-mt-28 sm:px-10 sm:scroll-mt-32 dark:border-white/15"
        >
          <div className="max-w-3xl">
            <h2 className="text-2xl font-semibold text-(--foreground)">
              {section.title}
            </h2>
            <p className="mt-2 text-(--muted-foreground)">{section.tagline}</p>
          </div>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {section.cards.map((card) => (
              <article
                key={card.title}
                className="hover-glow flex h-full flex-col justify-between rounded-3xl border border-white/60 bg-(--surface-alt) p-6 text-(--muted-foreground-strong) shadow-(--shadow-card) dark:border-white/15"
              >
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-(--foreground)">
                      {card.title}
                    </h3>
                    {card.badge ? (
                      <span className="rounded-full bg-(--accent)/15 px-3 py-1 text-xs font-semibold uppercase text-(--accent)">
                        {card.badge}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm text-(--muted-foreground)">
                    {card.description}
                  </p>
                </div>
                <Link
                  href={card.href}
                  className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-(--accent) transition-transform hover:translate-x-1"
                >
                  Ir al módulo →
                </Link>
              </article>
            ))}
          </div>
        </Reveal>
      ))}

      <Reveal className="rounded-3xl border border-white/60 bg-(--surface) px-6 py-8 shadow-(--shadow-card) sm:px-10 dark:border-white/15">
        <h2 className="text-2xl font-semibold text-(--foreground)">
          Siguiente sprint
        </h2>
        <ul className="mt-4 list-disc space-y-2 pl-6 text-sm text-(--muted-foreground)">
          {config.backlog.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Reveal>
    </div>
  );
}
