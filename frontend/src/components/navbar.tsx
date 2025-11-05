"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";

const links = [
  { href: "/#features", label: "Funciones" },
  { href: "/#locals", label: "Locales" },
  { href: "/#loyalty", label: "Lealtad" },
  { href: "/#contact", label: "Contacto" },
];

export function Navbar() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-white/40 bg-white/80 backdrop-blur dark:border-white/10 dark:bg-[#12100e]/75">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-semibold tracking-tight"
        >
          <span className="rounded-full bg-(--accent) px-2 py-1 text-xs font-semibold uppercase text-white">
            Beta
          </span>
          <span>Coffeefy</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-(--accent)"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <>
              <span className="text-sm text-(--muted-foreground)">
                Hola, {user.username}
              </span>
              <Link
                href="/dashboard"
                className="rounded-full bg-(--accent) px-4 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 hover:bg-(--accent-dark)"
              >
                Mi panel
              </Link>
              <button
                type="button"
                onClick={logout}
                className="text-sm font-medium text-(--muted-foreground) underline-offset-4 hover:underline"
              >
                Cerrar sesión
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-medium text-(--muted-foreground) transition-colors hover:text-(--accent)"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-(--accent) px-4 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 hover:bg-(--accent-dark)"
              >
                Crear cuenta
              </Link>
            </>
          )}
        </div>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md border border-neutral-200 px-3 py-2 text-sm font-medium md:hidden"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-label="Abrir navegación"
        >
          {open ? "Cerrar" : "Menú"}
        </button>
      </div>
      {open && (
        <nav className="border-t border-neutral-200 bg-(--surface) md:hidden">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 text-sm font-medium">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="transition-colors hover:text-(--accent)"
              >
                {link.label}
              </Link>
            ))}
            {user ? (
              <>
                <Link
                  href="/dashboard"
                  onClick={() => setOpen(false)}
                  className="rounded-full bg-(--accent) px-4 py-2 text-center font-semibold text-white"
                >
                  Mi panel
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    setOpen(false);
                  }}
                  className="text-left text-sm font-medium text-(--muted-foreground) underline-offset-4 hover:underline"
                >
                  Cerrar sesión
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="text-(--muted-foreground) hover:text-(--accent)"
                >
                  Iniciar sesión
                </Link>
                <Link
                  href="/register"
                  onClick={() => setOpen(false)}
                  className="rounded-full bg-(--accent) px-4 py-2 text-center font-semibold text-white"
                >
                  Crear cuenta
                </Link>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
