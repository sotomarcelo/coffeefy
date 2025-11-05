import Link from "next/link";

const footerLinks = [
  { label: "Equipo", href: "/#contact" },
  { label: "Soporte", href: "/#contact" },
  { label: "Documentación API", href: "https://github.com/" },
];

export function Footer() {
  return (
    <footer className="border-t border-neutral-200 bg-(--surface)">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 text-sm text-(--muted-foreground) sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h2 className="text-lg font-semibold text-(--foreground)">
            Coffeefy
          </h2>
          <p className="mt-1 max-w-sm text-pretty text-(--muted-foreground-soft)">
            Plataforma para conectar coffee lovers con cafeterías y tostadurías
            independientes.
          </p>
        </div>
        <nav className="flex flex-wrap items-center gap-4">
          {footerLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="transition-colors hover:text-(--accent)"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <p className="text-xs text-(--muted-foreground-soft)">
          © {new Date().getFullYear()} Coffeefy. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  );
}
