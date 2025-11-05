import { Reveal } from "@/components/reveal";

const featureCards = [
  {
    title: "Catálogo Unificado",
    description:
      "Administra bebidas y granos de café con disponibilidad en tiempo real y fotos listas para el menú digital.",
  },
  {
    title: "Pedidos Inteligentes",
    description:
      "Los clientes reservan y pagan desde la app; el equipo ve los estados en una consola colaborativa.",
  },
  {
    title: "Lealtad Omnicanal",
    description:
      "Puntos automáticos, recompensas personalizadas y QR para canjear tanto en cafeterías como tostadurías.",
  },
];

const loyaltyHighlights = [
  "Balances sincronizados entre sucursales",
  "Campañas estacionales configurables",
  "Redención con códigos únicos o recompensas directas",
];

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-24 px-4 py-16 sm:px-6">
      <section className="hero-card relative grid gap-12 rounded-3xl bg-(--surface) px-6 py-16 shadow-(--shadow-card) sm:grid-cols-[1.1fr_0.9fr] sm:px-12">
        <div className="space-y-6">
          <Reveal
            as="span"
            className="inline-flex items-center rounded-full bg-(--surface-alt) px-4 py-1 text-sm font-medium text-(--accent)"
          >
            Plataforma end-to-end para coffee lovers
          </Reveal>
          <Reveal
            as="h1"
            delay={80}
            className="text-pretty text-4xl font-semibold leading-tight text-(--foreground) sm:text-5xl"
          >
            Operaciones y fidelidad para cafeterías y tostadurías en una sola
            experiencia.
          </Reveal>
          <Reveal
            as="p"
            delay={140}
            className="max-w-xl text-lg text-(--muted-foreground)"
          >
            Coffeefy integra catálogo, pedidos y puntos para que puedas
            concentrarte en crear bebidas memorables.
          </Reveal>
          <Reveal delay={220} className="flex flex-col gap-4 sm:flex-row">
            <a
              href="/register"
              className="hover-glow rounded-full bg-(--accent) px-6 py-3 text-center text-sm font-semibold text-white shadow-(--shadow-card) transition-all hover:bg-(--accent-dark)"
            >
              Crear cuenta gratuita
            </a>
            <a
              href="/login"
              className="hover-glow rounded-full border border-white/70 px-6 py-3 text-center text-sm font-semibold text-(--foreground) transition-all hover:border-(--accent) dark:border-white/15"
            >
              Acceder a mi panel
            </a>
          </Reveal>
        </div>
        <Reveal
          delay={180}
          className="floating-card rounded-3xl border border-white/70 bg-(--surface-alt) p-8 text-sm text-(--muted-foreground) shadow-(--shadow-card) dark:border-white/10"
        >
          <h2 className="text-lg font-semibold text-(--foreground)">
            Lo que conecta Coffeefy
          </h2>
          <ul className="mt-6 space-y-4">
            <Reveal
              as="li"
              delay={220}
              className="rounded-2xl border border-white/70 bg-(--surface) p-4 shadow-(--shadow-card) dark:border-white/10"
            >
              <strong className="block text-sm text-(--accent)">
                Baristas
              </strong>
              <span>
                Control de pedidos, notificaciones y trazabilidad de clientes
                frecuentes.
              </span>
            </Reveal>
            <Reveal
              as="li"
              delay={280}
              className="rounded-2xl border border-white/70 bg-(--surface) p-4 shadow-(--shadow-card) dark:border-white/10"
            >
              <strong className="block text-sm text-(--accent)">
                Tostadurías
              </strong>
              <span>
                Gestión de lotes de granos, estados de tostado y stock por
                origen.
              </span>
            </Reveal>
            <Reveal
              as="li"
              delay={340}
              className="rounded-2xl border border-white/70 bg-(--surface) p-4 shadow-(--shadow-card) dark:border-white/10"
            >
              <strong className="block text-sm text-(--accent)">
                Clientes
              </strong>
              <span>
                Un solo perfil, puntos compartidos y recompensas transparentes.
              </span>
            </Reveal>
          </ul>
        </Reveal>
      </section>

      <section id="features" className="space-y-12">
        <Reveal className="max-w-2xl space-y-4">
          <h2 className="text-3xl font-semibold text-(--foreground)">
            Todo lo que necesitas para escalar tu experiencia de café
          </h2>
          <p className="text-(--muted-foreground)">
            Desde vitrina digital hasta programas de lealtad, Coffeefy
            automatiza lo manual y visibiliza lo importante.
          </p>
        </Reveal>
        <div className="grid gap-6 md:grid-cols-3">
          {featureCards.map((feature, index) => (
            <Reveal
              key={feature.title}
              as="article"
              delay={index * 90}
              className="hover-glow rounded-3xl border border-white/70 bg-(--surface) p-6 shadow-(--shadow-card) dark:border-white/10"
            >
              <h3 className="text-xl font-semibold text-(--foreground)">
                {feature.title}
              </h3>
              <p className="mt-3 text-sm text-(--muted-foreground)">
                {feature.description}
              </p>
            </Reveal>
          ))}
        </div>
      </section>

      <section
        id="loyalty"
        className="loyalty-card grid gap-10 rounded-3xl border border-white/50 bg-(--surface) px-6 py-12 shadow-(--shadow-card) sm:grid-cols-[1.1fr_0.9fr] sm:px-12 dark:border-white/10"
      >
        <Reveal className="space-y-5">
          <h2 className="text-3xl font-semibold text-(--foreground)">
            Lealtad pensada para locales físicos y digitales
          </h2>
          <p className="text-(--muted-foreground)">
            Configura reglas de puntos por tipo de producto, genera recompensas
            dinámicas y mide la recurrencia por segmento.
          </p>
          <ul className="space-y-3 text-sm text-(--muted-foreground)">
            {loyaltyHighlights.map((highlight, index) => (
              <Reveal
                key={highlight}
                as="li"
                delay={index * 90}
                className="flex items-start gap-3"
              >
                <span
                  className="mt-1 inline-block h-2 w-2 rounded-full bg-(--accent)"
                  aria-hidden
                />
                <span>{highlight}</span>
              </Reveal>
            ))}
          </ul>
        </Reveal>
        <Reveal
          delay={160}
          className="hover-glow rounded-2xl border border-white/50 bg-(--surface-alt) p-6 text-left shadow-(--shadow-card) dark:border-white/10"
        >
          <h3 className="text-lg font-semibold text-(--foreground)">
            Próximos hitos
          </h3>
          <ol className="mt-4 space-y-3 text-sm text-(--muted-foreground)">
            <li>
              <strong className="text-(--accent)">
                Integración con pasarelas
              </strong>{" "}
              – pagos en tiempo real conectados con órdenes.
            </li>
            <li>
              <strong className="text-(--accent)">
                Cross-selling automático
              </strong>{" "}
              – recomendaciones según historial y stock de granos.
            </li>
            <li>
              <strong className="text-(--accent)">Insights accionables</strong>{" "}
              – métricas de fidelidad listas para que tomes decisiones.
            </li>
          </ol>
        </Reveal>
      </section>

      <section id="locals" className="space-y-12">
        <Reveal className="max-w-2xl space-y-4">
          <h2 className="text-3xl font-semibold text-(--foreground)">
            Crea vitrinas para cada local
          </h2>
          <p className="text-(--muted-foreground)">
            Configura puntos de venta independientes o cadenas híbridas.
            Coffeefy sincroniza inventarios, pedidos y balances de puntos entre
            todas las sedes.
          </p>
        </Reveal>
        <div className="grid gap-6 md:grid-cols-2">
          <Reveal
            as="article"
            delay={80}
            className="hover-glow rounded-3xl border border-white/70 bg-(--surface) p-6 shadow-(--shadow-card) dark:border-white/10"
          >
            <h3 className="text-xl font-semibold text-(--foreground)">
              Cafeterías
            </h3>
            <p className="mt-2 text-sm text-(--muted-foreground)">
              Diseña menús dinámicos, controla tiempos de preparación y conoce a
              tus clientes recurrentes.
            </p>
          </Reveal>
          <Reveal
            as="article"
            delay={160}
            className="hover-glow rounded-3xl border border-white/70 bg-(--surface) p-6 shadow-(--shadow-card) dark:border-white/10"
          >
            <h3 className="text-xl font-semibold text-(--foreground)">
              Tostadurías
            </h3>
            <p className="mt-2 text-sm text-(--muted-foreground)">
              Sube lotes con origen, notas de cata y disponibilidad para venta
              directa o distribución a cafeterías.
            </p>
          </Reveal>
        </div>
      </section>

      <Reveal
        as="section"
        id="contact"
        delay={120}
        className="hover-glow rounded-3xl border border-white/60 bg-(--surface) px-6 py-12 text-center shadow-(--shadow-card) sm:px-12 dark:border-white/10"
      >
        <h2 className="text-3xl font-semibold text-(--foreground)">
          ¿Listo para servir la próxima ronda?
        </h2>
        <p className="mt-3 text-(--muted-foreground)">
          Escríbenos para sumarte al piloto privado o agenda una demo
          personalizada con el equipo.
        </p>
        <Reveal
          delay={180}
          className="mt-6 flex flex-col items-center justify-center gap-4 text-sm text-(--muted-foreground) sm:flex-row"
        >
          <a
            href="mailto:hola@coffeefy.app"
            className="rounded-full bg-(--accent) px-6 py-3 font-semibold text-white transition-transform hover:-translate-y-0.5 hover:bg-(--accent-dark)"
          >
            hola@coffeefy.app
          </a>
          <span>o</span>
          <a
            href="https://cal.com"
            target="_blank"
            rel="noopener"
            className="rounded-full border border-white/70 px-6 py-3 font-semibold text-(--foreground) transition-colors hover:border-(--accent) dark:border-white/15"
          >
            Agendar demo
          </a>
        </Reveal>
      </Reveal>
    </div>
  );
}
