"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { ROLE_CONFIG, ROLE_LABELS, RoleKey } from "./config";

const BASE_NAVIGATION = [
  { label: "Resumen", href: "/dashboard" },
  { label: "Perfil del local", href: "/dashboard/local" },
  { label: "Catálogo", href: "/dashboard/productos" },
  { label: "Operaciones", href: "/dashboard/pedidos" },
  { label: "Lealtad", href: "/dashboard/puntos" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const roleKey = (user?.role as RoleKey) ?? "default";
  const roleLabel = ROLE_LABELS[roleKey] ?? ROLE_LABELS.default;
  const sectionNavigation =
    ROLE_CONFIG[roleKey]?.navigation ?? ROLE_CONFIG.default.navigation;

  const handleLogout = () => {
    logout();
    setIsSidebarOpen(false);
  };

  return (
    <div className="flex min-h-screen bg-(--surface-alt)/70 text-(--foreground) lg:h-screen lg:overflow-hidden">
      <button
        type="button"
        onClick={() => setIsSidebarOpen(true)}
        className="fixed left-4 top-4 z-40 inline-flex items-center gap-2 rounded-full border border-white/20 bg-(--surface) px-4 py-2 text-sm font-semibold text-(--foreground) shadow-(--shadow-card) transition hover:border-(--accent) hover:text-(--accent) lg:hidden"
      >
        <span className="text-base">☰</span>
        Menú
      </button>

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 transform flex-col bg-(--surface) px-6 py-8 shadow-(--shadow-card) transition-transform duration-300 ease-in-out dark:border-white/10 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:border-r lg:border-white/15 lg:shadow-none lg:inset-y-auto ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/15 pb-6">
          <Link
            href="/dashboard"
            className="text-lg font-semibold text-(--foreground)"
            onClick={() => setIsSidebarOpen(false)}
          >
            Coffeefy Panel
          </Link>
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="rounded-full border border-white/20 px-2 py-1 text-xs text-(--muted-foreground) transition hover:border-(--accent) hover:text-(--accent) lg:hidden"
          >
            Cerrar
          </button>
        </div>

        <div className="mt-6 flex-1 space-y-6 overflow-y-auto text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-(--muted-foreground-soft)">
              Panel
            </p>
            <nav className="mt-3 flex flex-col gap-1">
              {BASE_NAVIGATION.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-xl px-3 py-2 font-medium transition-colors ${
                      isActive
                        ? "bg-(--surface-alt) text-(--foreground)"
                        : "text-(--muted-foreground) hover:text-(--accent)"
                    }`}
                    onClick={() => setIsSidebarOpen(false)}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-(--muted-foreground-soft)">
              Secciones activas
            </p>
            <nav className="mt-3 flex flex-col gap-1">
              {sectionNavigation.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="rounded-xl px-3 py-2 font-medium text-(--muted-foreground) transition-colors hover:text-(--accent)"
                  onClick={() => setIsSidebarOpen(false)}
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
        </div>

        <div className="mt-auto pt-6">
          <div className="rounded-2xl border border-white/15 bg-(--surface-alt) px-4 py-3 text-sm">
            <p className="text-xs uppercase tracking-wide text-(--muted-foreground-soft)">
              Rol activo
            </p>
            <p className="text-base font-semibold text-(--foreground)">
              {roleLabel}
            </p>
            {user ? (
              <p className="text-xs text-(--muted-foreground)">
                {user.username}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-4 w-full rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-(--foreground) transition hover:border-(--accent) hover:text-(--accent)"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {isSidebarOpen ? (
        <div
          role="presentation"
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
        />
      ) : null}

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-(--surface)/90 px-6 py-4 backdrop-blur">
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wide text-(--muted-foreground-soft)">
              Panel Coffeefy
            </span>
            <span className="text-xl font-semibold text-(--foreground)">
              {user ? `Hola, ${user.username}` : "Bienvenido"}
            </span>
          </div>
          <div className="hidden items-center gap-3 rounded-full border border-white/20 bg-(--surface-alt) px-4 py-2 text-sm font-semibold text-(--foreground) lg:flex">
            {roleLabel}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-8 lg:h-screen">
          {children}
        </main>
      </div>
    </div>
  );
}
