export type RoleKey =
  | "cliente"
  | "cafeteria"
  | "tostaduria"
  | "hibrido"
  | "admin";

export type MetricCard = {
  title: string;
  value: string;
  delta: string;
};

export type QuickAction = {
  href: string;
  label: string;
  description: string;
};

export type SectionCard = {
  title: string;
  description: string;
  href: string;
  badge?: string;
};

export type DashboardSection = {
  id: string;
  title: string;
  tagline: string;
  cards: SectionCard[];
};

export type DashboardConfig = {
  heroTitle: string;
  heroDescription: string;
  metrics: MetricCard[];
  quickActions: QuickAction[];
  navigation: { label: string; href: string }[];
  sections: DashboardSection[];
  backlog: string[];
};

export const DEFAULT_CONFIG: DashboardConfig = {
  heroTitle: "Panel Coffeefy",
  heroDescription:
    "Explora métricas en tiempo real, administra tu catálogo y recompensa la fidelidad de tus clientes.",
  metrics: [
    { title: "Ingresos", value: "$12.4K", delta: "+18% semanal" },
    { title: "Pedidos activos", value: "27", delta: "4 urgentes" },
    { title: "Canjes de puntos", value: "112", delta: "+32 esta semana" },
  ],
  quickActions: [
    {
      href: "/dashboard/productos",
      label: "Catálogo unificado",
      description: "Crea bebidas, lotes y combos listos para vitrina digital.",
    },
    {
      href: "/dashboard/pedidos",
      label: "Pedidos en vivo",
      description: "Sigue estados, prioriza retiradas y coordina al equipo.",
    },
    {
      href: "/dashboard/puntos",
      label: "Programa de lealtad",
      description: "Configura campañas, tiers y recompensas instantáneas.",
    },
  ],
  navigation: [
    { label: "Catálogo", href: "#module-catalogo" },
    { label: "Operaciones", href: "#module-operaciones" },
    { label: "Lealtad", href: "#module-lealtad" },
  ],
  sections: [
    {
      id: "catalogo",
      title: "Catálogo conectado",
      tagline:
        "Mantén tus productos sincronizados entre bebida y grano con fotos, costos y disponibilidad en vivo.",
      cards: [
        {
          title: "Gestor de productos",
          description:
            "Carga bebidas, combos y lotes con reglas de stock y notas de cata.",
          href: "/dashboard/productos",
          badge: "Nuevo",
        },
        {
          title: "Listas dinámicas",
          description: "Genera menús QR por sucursal y horarios.",
          href: "/dashboard/productos/listas",
        },
        {
          title: "Análisis de ventas",
          description: "Detecta top sellers y rotación para ajustar oferta.",
          href: "/dashboard/productos/analytics",
        },
      ],
    },
    {
      id: "operaciones",
      title: "Operaciones en tiempo real",
      tagline:
        "Coordina la barra, el área de tueste y la atención al cliente desde una sola consola.",
      cards: [
        {
          title: "Pedidos y tiempos",
          description: "Monitorea estados, SLAs y alertas de bebida pendiente.",
          href: "/dashboard/pedidos",
        },
        {
          title: "Panel del equipo",
          description: "Asigna roles, turnos y objetivos de servicio por día.",
          href: "/dashboard/equipo",
        },
        {
          title: "Inventario crítico",
          description:
            "Recibe avisos cuando los insumos clave lleguen al umbral mínimo.",
          href: "/dashboard/inventario",
        },
      ],
    },
    {
      id: "lealtad",
      title: "Lealtad y comunidad",
      tagline:
        "Convierte visitas en recurrencia con campañas omnicanal y datos accionables.",
      cards: [
        {
          title: "Campañas de puntos",
          description: "Configura multiplicadores y bonos por segmento.",
          href: "/dashboard/puntos/campanas",
        },
        {
          title: "Recompensas",
          description: "Publica canjes inmediatos o combos especiales.",
          href: "/dashboard/puntos/recompensas",
        },
        {
          title: "Insights de fidelidad",
          description: "Sigue recurrencia, ticket promedio y cohortes.",
          href: "/dashboard/insights",
        },
      ],
    },
  ],
  backlog: [
    "Sincronizar inventario en tiempo real con el POS.",
    "Agregar métricas de satisfacción (NPS, reviews).",
    "Activar campañas automáticas por clima o festividades.",
  ],
};

export const ROLE_CONFIG: Record<RoleKey | "default", DashboardConfig> = {
  default: DEFAULT_CONFIG,
  cliente: DEFAULT_CONFIG,
  cafeteria: {
    heroTitle: "Panel de cafetería",
    heroDescription:
      "Orquesta barra, vitrina y clientes recurrentes sin perder visibilidad del flujo de pedidos.",
    metrics: [
      { title: "Ventas de bebidas", value: "$8.9K", delta: "+12% vs. ayer" },
      {
        title: "Tiempo promedio de preparación",
        value: "04:32",
        delta: "-35 seg.",
      },
      { title: "Clientes frecuentes", value: "312", delta: "+18 en 7 días" },
    ],
    quickActions: [
      {
        href: "/dashboard/productos?scope=cafeteria",
        label: "Menú espresso",
        description: "Actualiza bebidas signature y notas de receta.",
      },
      {
        href: "/dashboard/pedidos?view=bar",
        label: "Cola en barra",
        description: "Visualiza pedidos pendientes y tiempos de entrega.",
      },
      {
        href: "/dashboard/puntos?segment=vip",
        label: "Clientes VIP",
        description: "Premia visitas frecuentes con recompensas expresas.",
      },
    ],
    navigation: [
      { label: "Catálogo", href: "#module-catalogo" },
      { label: "Operaciones", href: "#module-operaciones" },
      { label: "Lealtad", href: "#module-lealtad" },
    ],
    sections: [
      {
        id: "catalogo",
        title: "Catálogo vivo",
        tagline:
          "Modifica recetas, tamaños y bundles según horarios pico y disponibilidad de granos.",
        cards: [
          {
            title: "Recetas espresso",
            description:
              "Controla dosis, calibraciones y perfiles por máquina.",
            href: "/dashboard/productos/recetas",
          },
          {
            title: "Vitrina digital",
            description: "Publica menú QR con fotos y filtros por sabores.",
            href: "/dashboard/productos/vitrina",
          },
          {
            title: "Promociones",
            description: "Activa happy hours y combos automáticos en caja.",
            href: "/dashboard/productos/promos",
          },
        ],
      },
      {
        id: "operaciones",
        title: "Operación de sala",
        tagline:
          "Mide tiempos por estación, asigna responsabilidades y mantén al equipo sincronizado.",
        cards: [
          {
            title: "Consola de pedidos",
            description:
              "Seguimiento de estados con alertas de pedidos rezagados.",
            href: "/dashboard/pedidos",
          },
          {
            title: "Turnos y roles",
            description:
              "Administra baristas, runners y caja en un calendario.",
            href: "/dashboard/equipo/turnos",
          },
          {
            title: "Stock crítico",
            description:
              "Controla leche, jarabes y panadería con reposición sugerida.",
            href: "/dashboard/inventario/insumos",
          },
        ],
      },
      {
        id: "lealtad",
        title: "Lealtad omnicanal",
        tagline:
          "Crea campañas que combinen consumo en barra, takeaway y pedidos programados.",
        cards: [
          {
            title: "Multiplicadores por horario",
            description:
              "Bonifica visitas en franjas lentas para elevar ocupación.",
            href: "/dashboard/puntos/multiplicadores",
          },
          {
            title: "Club latte lovers",
            description:
              "Define tiers con beneficios exclusivos y storytelling.",
            href: "/dashboard/puntos/club",
          },
          {
            title: "Feedback instantáneo",
            description:
              "Lanza encuestas QR tras canje para medir satisfacción.",
            href: "/dashboard/insights/feedback",
          },
        ],
      },
    ],
    backlog: [
      "Integrar sensores de flujo para medir tiempos por estación.",
      "Sincronizar promociones con marketería digital y pantallas.",
      "Habilitar inventario automático con proveedores locales.",
    ],
  },
  tostaduria: {
    heroTitle: "Panel de tostaduría",
    heroDescription:
      "Controla lotes, curvas de tueste y distribuciones mayoristas sin perder trazabilidad de puntos.",
    metrics: [
      { title: "Lotes tostados", value: "18", delta: "+5 esta semana" },
      { title: "Inventario disponible", value: "642 kg", delta: "-12%" },
      { title: "Suscripciones activas", value: "94", delta: "+7" },
    ],
    quickActions: [
      {
        href: "/dashboard/productos?scope=tostaduria",
        label: "Catálogo de granos",
        description: "Actualiza notas, tuestes y formatos de empaque.",
      },
      {
        href: "/dashboard/logistica",
        label: "Logística",
        description: "Coordina envíos mayoristas y seguimiento de lotes.",
      },
      {
        href: "/dashboard/puntos/wholesale",
        label: "Programa wholesale",
        description: "Bonifica cafeterías asociadas con puntos y descuentos.",
      },
    ],
    navigation: [
      { label: "Lotes", href: "#module-lotes" },
      { label: "Distribución", href: "#module-logistica" },
      { label: "Lealtad B2B", href: "#module-lealtad" },
    ],
    sections: [
      {
        id: "lotes",
        title: "Gestión de lotes",
        tagline:
          "Planea tu producción, registra curvas y publica disponibilidad al instante.",
        cards: [
          {
            title: "Planificador de tueste",
            description:
              "Agenda sesiones, curvas y responsables por tostadora.",
            href: "/dashboard/tostaduria/planificador",
          },
          {
            title: "Ficha de origen",
            description: "Crea fichas con trazabilidad y notas para clientes.",
            href: "/dashboard/tostaduria/fichas",
          },
          {
            title: "Control de calidad",
            description: "Registra cataciones y alertas de consistencia.",
            href: "/dashboard/tostaduria/calidad",
          },
        ],
      },
      {
        id: "logistica",
        title: "Logística y distribución",
        tagline: "Integra envíos, contratos wholesale y pedidos recurrentes.",
        cards: [
          {
            title: "Suscripciones",
            description:
              "Administra entregas para cafeterías y clientes home barista.",
            href: "/dashboard/logistica/suscripciones",
          },
          {
            title: "Gestión de órdenes",
            description: "Consolida pedidos, facturas y estados de envío.",
            href: "/dashboard/logistica/ordenes",
          },
          {
            title: "Integración 3PL",
            description: "Sincroniza inventario con operadores logísticos.",
            href: "/dashboard/logistica/integraciones",
          },
        ],
      },
      {
        id: "lealtad",
        title: "Lealtad mayorista",
        tagline:
          "Fortalece alianzas con cafeterías socias y tiendas de especialidad.",
        cards: [
          {
            title: "Crecimiento por socio",
            description: "Mide volumen, frecuencia y salud del partnership.",
            href: "/dashboard/insights/wholesale",
          },
          {
            title: "Programa de incentivos",
            description:
              "Recompensa compras recurrentes con descuentos o equipos.",
            href: "/dashboard/puntos/incentivos",
          },
          {
            title: "Academia",
            description:
              "Comparte cursos y protocolos para tu red de cafeterías.",
            href: "/dashboard/comunidad/academia",
          },
        ],
      },
    ],
    backlog: [
      "Automatizar cálculo de costos por lote y margen sugerido.",
      "Incorporar predicción de demanda por origen.",
      "Lanzar app móvil para catadores externos.",
    ],
  },
  hibrido: {
    heroTitle: "Panel híbrido",
    heroDescription:
      "Gestiona la cafetería y la tostaduría en un tablero unificado para optimizar toda la cadena.",
    metrics: [
      { title: "Utilización de granos", value: "87%", delta: "+6% eficiencia" },
      { title: "Locales activos", value: "5", delta: "+1 nueva sede" },
      { title: "Satisfacción", value: "4.8/5", delta: "+0.2 trimestre" },
    ],
    quickActions: [
      {
        href: "/dashboard/productos?scope=hibrido",
        label: "Catálogo vinculado",
        description: "Conecta lotes tostados con bebidas disponibles.",
      },
      {
        href: "/dashboard/operaciones",
        label: "Flujo completo",
        description: "Visualiza pedido → tueste → barra en un timeline.",
      },
      {
        href: "/dashboard/puntos/omni",
        label: "Lealtad 360º",
        description:
          "Une recompensas retail y mayoristas en una sola billetera.",
      },
    ],
    navigation: [
      { label: "Producción", href: "#module-produccion" },
      { label: "Sala", href: "#module-sala" },
      { label: "Relaciones", href: "#module-relaciones" },
    ],
    sections: [
      {
        id: "produccion",
        title: "Producción sincronizada",
        tagline:
          "Une planificación de tueste e inventario de barra para evitar quiebres y excedentes.",
        cards: [
          {
            title: "Plan maestro",
            description:
              "Equilibra demanda retail y wholesale en una sola vista.",
            href: "/dashboard/hibrido/plan-maestro",
          },
          {
            title: "Distribución interna",
            description:
              "Envía lotes a cada sede con trazabilidad de frescura.",
            href: "/dashboard/hibrido/distribucion",
          },
          {
            title: "Alertas de origen",
            description: "Recibe avisos si un origen crítico se agota.",
            href: "/dashboard/hibrido/alertas",
          },
        ],
      },
      {
        id: "sala",
        title: "Sala y experiencia",
        tagline:
          "Mantén el estándar de servicio en todas las cafeterías con datos y coaching continuo.",
        cards: [
          {
            title: "Score de barra",
            description:
              "Evalúa consistencia de extracción y velocidad de servicio.",
            href: "/dashboard/hibrido/score-bar",
          },
          {
            title: "Capacitaciones",
            description: "Agenda sesiones con head barista y cataciones.",
            href: "/dashboard/comunidad/capacitaciones",
          },
          {
            title: "Experiencias",
            description: "Diseña eventos y catas para fidelizar comunidad.",
            href: "/dashboard/comunidad/eventos",
          },
        ],
      },
      {
        id: "relaciones",
        title: "Relación con clientes",
        tagline:
          "Gestiona comunicación con clientes B2B y consumidores finales desde un mismo módulo.",
        cards: [
          {
            title: "Segmentos omnicanal",
            description:
              "Combina datos retail y wholesale para acciones precisas.",
            href: "/dashboard/puntos/segmentos",
          },
          {
            title: "Campañas conjuntas",
            description: "Lanza promociones cruzadas entre tiendas y socios.",
            href: "/dashboard/marketing/campanas",
          },
          {
            title: "Insights 360°",
            description:
              "Analiza ticket, recurrencia y valor de vida por canal.",
            href: "/dashboard/insights/360",
          },
        ],
      },
    ],
    backlog: [
      "Automatizar balance de stock entre sedes y bodega central.",
      "Integrar dashboards financieros para márgenes combinados.",
      "Lanzar marketplace para socios que revenden tus granos.",
    ],
  },
  admin: {
    heroTitle: "Panel administrativo",
    heroDescription:
      "Administra usuarios, permisos y configuraciones globales de Coffeefy desde un solo espacio.",
    metrics: [
      { title: "Usuarios activos", value: "1.2K", delta: "+54 nuevos" },
      { title: "Locales conectados", value: "86", delta: "+4 esta semana" },
      { title: "Tickets abiertos", value: "9", delta: "-3" },
    ],
    quickActions: [
      {
        href: "/dashboard/admin/usuarios",
        label: "Gestión de usuarios",
        description: "Invita cuentas, resetea contraseñas y define roles.",
      },
      {
        href: "/dashboard/admin/config",
        label: "Parámetros",
        description: "Configura branding, pasarelas y plantillas de correo.",
      },
      {
        href: "/dashboard/admin/reportes",
        label: "Reportes",
        description: "Exporta métricas globales y auditorías de actividad.",
      },
    ],
    navigation: [
      { label: "Control", href: "#module-control" },
      { label: "Reportes", href: "#module-reportes" },
      { label: "Infraestructura", href: "#module-infra" },
    ],
    sections: [
      {
        id: "control",
        title: "Control de acceso",
        tagline:
          "Mantén permisos y roles alineados a la operación de cada franquicia.",
        cards: [
          {
            title: "Roles personalizados",
            description:
              "Configura reglas por perfil: barista, manager, franquiciado.",
            href: "/dashboard/admin/roles",
          },
          {
            title: "Auditoría",
            description: "Monitorea actividad sensible y cambios críticos.",
            href: "/dashboard/admin/auditoria",
          },
          {
            title: "Integraciones",
            description: "Autoriza apps de terceros con OAuth Coffeefy.",
            href: "/dashboard/admin/integraciones",
          },
        ],
      },
      {
        id: "reportes",
        title: "Reportes globales",
        tagline:
          "Centraliza métricas de ventas, retención y logística por región.",
        cards: [
          {
            title: "Panel ejecutivo",
            description: "Mira KPIs clave con filtros por mercado.",
            href: "/dashboard/admin/kpis",
          },
          {
            title: "Proyecciones",
            description: "Modela escenarios de crecimiento y aperturas.",
            href: "/dashboard/admin/proyecciones",
          },
          {
            title: "SLA soporte",
            description: "Controla tiempos de respuesta del equipo de soporte.",
            href: "/dashboard/admin/soporte",
          },
        ],
      },
      {
        id: "infra",
        title: "Infraestructura",
        tagline:
          "Configura dominios, APIs y webhooks para automatizar procesos.",
        cards: [
          {
            title: "Pasarelas",
            description: "Administra credenciales y reconciliación de pagos.",
            href: "/dashboard/admin/pagos",
          },
          {
            title: "Webhooks",
            description: "Dispara flujos en CRM o ERP al momento.",
            href: "/dashboard/admin/webhooks",
          },
          {
            title: "Backup y seguridad",
            description: "Programa backups, alertas y políticas de acceso.",
            href: "/dashboard/admin/seguridad",
          },
        ],
      },
    ],
    backlog: [
      "Crear panel de billing para partners.",
      "Lanzar centro de ayuda multilingüe.",
      "Automatizar dashboards regionales.",
    ],
  },
};

export const ROLE_LABELS: Record<RoleKey | "default", string> = {
  default: "Operación",
  cliente: "Cliente",
  cafeteria: "Cafetería",
  tostaduria: "Tostaduría",
  hibrido: "Híbrido",
  admin: "Administrador",
};
