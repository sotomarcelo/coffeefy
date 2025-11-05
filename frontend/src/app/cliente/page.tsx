"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Reveal } from "@/components/reveal";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch, ApiError } from "@/lib/api";

const REDEMPTION_WINDOW_DAYS = 30;

type LocalOption = {
  id: number;
  name: string;
};

type TagDetails = {
  id: number;
  name: string;
  icon: string | null;
  accent_color: string | null;
};

type Local = {
  id: number;
  name: string;
  headline: string;
  highlights: string;
  description: string;
  address: string;
  schedule: string;
  type: string;
  cover_image_url: string | null;
  website_url: string;
  instagram_url: string;
  contact_phone: string;
  contact_email: string;
  map_url: string;
  points_rate: number;
  tag_details: TagDetails[];
};

type PointBalance = {
  id: number;
  user: number;
  user_name: string;
  local: number;
  local_name: string;
  total: number;
  updated_at: string;
};

type Reward = {
  id: number;
  local: number;
  local_name: string;
  name: string;
  description: string;
  points_required: number;
  image_url: string | null;
  active: boolean;
  redemption_count: number;
};

type CatalogProduct = {
  id: number;
  local: number;
  name: string;
  description: string;
  price: string;
  category: number | null;
  category_name: string;
  category_slug: string;
  display_order: number;
  image_url: string | null;
  in_stock: boolean;
  is_active: boolean;
  state: string;
  stock_state: string;
};

type CatalogGroup = {
  categoryId: number | null;
  categoryName: string;
  items: CatalogProduct[];
};

type Redemption = {
  id: number;
  user: number;
  user_name: string;
  local: number;
  local_name: string;
  reward: number | null;
  reward_name: string | null;
  description: string;
  points_used: number;
  created_at: string;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-CL").format(value);
}

function formatCurrency(value: number | string) {
  const numeric = typeof value === "string" ? Number.parseFloat(value) : value;
  if (!Number.isFinite(numeric)) {
    return "$0";
  }
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numeric);
}

function safeParse(dateString: string) {
  const parsed = parseISO(dateString);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function splitHighlights(value: string) {
  return value
    .split(/\r?\n|•/)
    .map((item) => item.replace(/^[\s*-]+/, "").trim())
    .filter(Boolean);
}

function groupProductsByCategory(products: CatalogProduct[]): CatalogGroup[] {
  const groups: CatalogGroup[] = [];
  const indexByCategory = new Map<number | "uncategorized", number>();

  products.forEach((product) => {
    const key = product.category ?? -1;
    const mapKey = key === -1 ? "uncategorized" : key;
    let groupIndex = indexByCategory.get(mapKey);
    if (groupIndex === undefined) {
      groupIndex = groups.length;
      indexByCategory.set(mapKey, groupIndex);
      groups.push({
        categoryId: product.category ?? null,
        categoryName:
          product.category_name && product.category_name.length > 0
            ? product.category_name
            : "Sin categoría",
        items: [],
      });
    }
    groups[groupIndex].items.push(product);
  });

  return groups;
}

export default function ClientWalletPage() {
  const { user, accessToken } = useAuth();

  const [balances, setBalances] = useState<PointBalance[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [locals, setLocals] = useState<Local[]>([]);
  const [localsLoading, setLocalsLoading] = useState(true);
  const [localsError, setLocalsError] = useState<string | null>(null);
  const [expandedLocals, setExpandedLocals] = useState<number[]>([]);
  const [catalogs, setCatalogs] = useState<Record<number, CatalogProduct[]>>(
    {}
  );
  const [catalogLoading, setCatalogLoading] = useState<Record<number, boolean>>(
    {}
  );
  const [catalogErrors, setCatalogErrors] = useState<Record<number, string>>(
    {}
  );
  const [selectedLocalId, setSelectedLocalId] = useState<number | "all">("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const localTypeLabels: Record<string, string> = useMemo(
    () => ({
      cafeteria: "Cafetería",
      hibrido: "Híbrido",
      tostaduria: "Tostaduría",
    }),
    []
  );

  const localOptions = useMemo<LocalOption[]>(() => {
    const map = new Map<number, LocalOption>();
    locals.forEach((local) => {
      map.set(local.id, { id: local.id, name: local.name });
    });
    balances.forEach((balance) => {
      map.set(balance.local, { id: balance.local, name: balance.local_name });
    });
    rewards.forEach((reward) => {
      map.set(reward.local, { id: reward.local, name: reward.local_name });
    });
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [locals, balances, rewards]);

  useEffect(() => {
    if (selectedLocalId === "all" && localOptions.length === 1) {
      setSelectedLocalId(localOptions[0].id);
    }
  }, [localOptions, selectedLocalId]);

  const fetchWalletData = useCallback(
    async (options?: { initial?: boolean }) => {
      if (!accessToken) return;
      setError(null);
      if (options?.initial) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const baseParams = new URLSearchParams();
        if (selectedLocalId !== "all") {
          baseParams.set("local", String(selectedLocalId));
        }

        const balancesQuery = baseParams.toString();
        const rewardsParams = new URLSearchParams(baseParams);
        rewardsParams.set("ordering", "points_required,name");
        const redemptionsParams = new URLSearchParams(baseParams);
        redemptionsParams.set("since_days", String(REDEMPTION_WINDOW_DAYS));
        redemptionsParams.set("limit", "20");

        const [balancesResponse, rewardsResponse, redemptionsResponse] =
          await Promise.all([
            apiFetch<PointBalance[]>(
              `/api/points/${balancesQuery ? `?${balancesQuery}` : ""}`,
              { token: accessToken ?? undefined }
            ),
            apiFetch<Reward[]>(
              `/api/rewards/available/${
                rewardsParams.toString() ? `?${rewardsParams.toString()}` : ""
              }`,
              { token: accessToken ?? undefined }
            ),
            apiFetch<Redemption[]>(
              `/api/redemptions/${
                redemptionsParams.toString()
                  ? `?${redemptionsParams.toString()}`
                  : ""
              }`,
              { token: accessToken ?? undefined }
            ),
          ]);

        setBalances(balancesResponse);
        setRewards(rewardsResponse);
        setRedemptions(redemptionsResponse);
        setLastUpdated(new Date().toISOString());
      } catch (err) {
        console.error(err);
        const message =
          err instanceof ApiError && err.details
            ? typeof err.details === "string"
              ? err.details
              : "No pudimos cargar tus datos."
            : "No pudimos cargar tus datos.";
        setError(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [accessToken, selectedLocalId]
  );

  const fetchLocals = useCallback(async () => {
    setLocalsLoading(true);
    setLocalsError(null);
    try {
      const response = await apiFetch<Local[]>("/api/locals/", {
        token: accessToken ?? undefined,
      });
      const filtered = response
        .filter((local) => ["cafeteria", "hibrido"].includes(local.type))
        .sort((a, b) => a.name.localeCompare(b.name));
      setLocals(filtered);
    } catch (err) {
      console.error(err);
      const message =
        err instanceof ApiError && err.details
          ? typeof err.details === "string"
            ? err.details
            : "No pudimos listar las cafeterías."
          : "No pudimos listar las cafeterías.";
      setLocalsError(message);
    } finally {
      setLocalsLoading(false);
    }
  }, [accessToken]);

  const loadCatalog = useCallback(
    async (localId: number) => {
      if (catalogs[localId]) {
        return;
      }
      setCatalogLoading((prev) => ({ ...prev, [localId]: true }));
      setCatalogErrors((prev) => {
        const next = { ...prev };
        delete next[localId];
        return next;
      });

      try {
        const params = new URLSearchParams();
        params.set("local", String(localId));
        params.set("in_stock", "true");
        params.set("ordering", "category,display_order,name");

        const response = await apiFetch<CatalogProduct[]>(
          `/api/products/?${params.toString()}`,
          { token: accessToken ?? undefined }
        );

        const activeProducts = response.filter(
          (product) => product.is_active !== false
        );

        setCatalogs((prev) => ({ ...prev, [localId]: activeProducts }));
      } catch (err) {
        console.error(err);
        const message =
          err instanceof ApiError && err.details
            ? typeof err.details === "string"
              ? err.details
              : "No pudimos cargar el catálogo."
            : "No pudimos cargar el catálogo.";
        setCatalogErrors((prev) => ({ ...prev, [localId]: message }));
      } finally {
        setCatalogLoading((prev) => ({ ...prev, [localId]: false }));
      }
    },
    [accessToken, catalogs]
  );

  useEffect(() => {
    if (!user || !accessToken) {
      setLoading(false);
      setLocalsLoading(false);
      return;
    }
    fetchWalletData({ initial: true });
    fetchLocals();
  }, [user, accessToken, fetchWalletData, fetchLocals]);

  useEffect(() => {
    if (locals.length !== 1) {
      return;
    }
    const onlyLocal = locals[0];
    if (!expandedLocals.includes(onlyLocal.id)) {
      setExpandedLocals([onlyLocal.id]);
    }
    if (!catalogs[onlyLocal.id]) {
      void loadCatalog(onlyLocal.id);
    }
  }, [locals, expandedLocals, catalogs, loadCatalog]);

  const handleRefresh = useCallback(() => {
    fetchWalletData();
  }, [fetchWalletData]);

  const handleRefreshLocals = useCallback(() => {
    fetchLocals();
  }, [fetchLocals]);

  const handleToggleLocal = useCallback(
    (localId: number) => {
      setExpandedLocals((prev) =>
        prev.includes(localId)
          ? prev.filter((id) => id !== localId)
          : [...prev, localId]
      );
      if (!catalogs[localId]) {
        void loadCatalog(localId);
      }
    },
    [catalogs, loadCatalog]
  );

  const totalPoints = useMemo(
    () => balances.reduce((acc, balance) => acc + balance.total, 0),
    [balances]
  );
  const localsWithPoints = useMemo(
    () => new Set(balances.map((balance) => balance.local)).size,
    [balances]
  );
  const redeemedPoints = useMemo(
    () =>
      redemptions.reduce((acc, redemption) => acc + redemption.points_used, 0),
    [redemptions]
  );
  const lastRedemption = redemptions[0] ?? null;
  const lastRedemptionDistance = useMemo(() => {
    if (!lastRedemption) return null;
    const parsed = safeParse(lastRedemption.created_at);
    if (!parsed) return null;
    return formatDistanceToNow(parsed, { addSuffix: true, locale: es });
  }, [lastRedemption]);

  const lastUpdatedLabel = useMemo(() => {
    if (!lastUpdated) return null;
    const parsed = safeParse(lastUpdated);
    if (!parsed) return null;
    return formatDistanceToNow(parsed, { addSuffix: true, locale: es });
  }, [lastUpdated]);

  if (!user) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4 rounded-3xl border border-white/15 bg-(--surface) p-10 text-center shadow-(--shadow-card)">
        <h1 className="text-2xl font-semibold text-(--foreground)">
          Inicia sesión para ver tus puntos
        </h1>
        <p className="text-(--muted-foreground)">
          Crea una cuenta o inicia sesión para revisar tus balances y
          recompensas.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="animate-pulse rounded-3xl border border-white/10 bg-(--surface) p-8"
          >
            <div className="h-6 w-1/3 rounded bg-(--surface-alt)" />
            <div className="mt-4 h-4 w-full rounded bg-(--surface-alt)" />
            <div className="mt-2 h-4 w-2/3 rounded bg-(--surface-alt)" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <Reveal
        id="mis-puntos"
        className="rounded-3xl border border-white/15 bg-(--surface) p-8 shadow-(--shadow-card)"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-(--foreground)">
              Mi billetera Coffeefy
            </h1>
            <p className="text-sm text-(--muted-foreground)">
              Consulta tus puntos disponibles, recompensas activas y últimos
              canjes.
            </p>
            {lastUpdatedLabel ? (
              <p className="text-xs text-(--muted-foreground)">
                Actualizado {lastUpdatedLabel}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-semibold text-(--foreground)">
              Local
              <select
                value={
                  selectedLocalId === "all" ? "all" : String(selectedLocalId)
                }
                onChange={(event) => {
                  const value = event.target.value;
                  setSelectedLocalId(value === "all" ? "all" : Number(value));
                }}
                className="mt-1 w-full rounded-xl border border-white/20 bg-(--surface-alt) px-4 py-2 text-sm text-(--foreground) shadow-sm focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
              >
                <option value="all">Todos</option>
                {localOptions.map((local) => (
                  <option key={local.id} value={local.id}>
                    {local.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-(--muted-foreground) transition hover:border-(--accent) hover:text-(--accent) disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? "Actualizando…" : "Refrescar"}
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-(--surface-alt) p-4">
            <p className="text-xs uppercase tracking-wide text-(--muted-foreground)">
              Puntos disponibles
            </p>
            <p className="mt-2 text-3xl font-semibold text-(--foreground)">
              {formatNumber(totalPoints)}
            </p>
            <p className="text-xs text-(--muted-foreground)">
              Saldo total acumulado
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-(--surface-alt) p-4">
            <p className="text-xs uppercase tracking-wide text-(--muted-foreground)">
              Locales con saldo
            </p>
            <p className="mt-2 text-3xl font-semibold text-blue-500">
              {localsWithPoints}
            </p>
            <p className="text-xs text-(--muted-foreground)">
              Donde puedes acumular o canjear puntos
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-(--surface-alt) p-4">
            <p className="text-xs uppercase tracking-wide text-(--muted-foreground)">
              Puntos canjeados
            </p>
            <p className="mt-2 text-3xl font-semibold text-emerald-500">
              {formatNumber(redeemedPoints)}
            </p>
            <p className="text-xs text-(--muted-foreground)">
              Últimos {REDEMPTION_WINDOW_DAYS} días
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-(--surface-alt) p-4">
            <p className="text-xs uppercase tracking-wide text-(--muted-foreground)">
              Último canje
            </p>
            <p className="mt-2 text-sm font-semibold text-(--foreground)">
              {lastRedemption
                ? `${
                    lastRedemption.reward_name ?? "Recompensa"
                  } · ${formatNumber(lastRedemption.points_used)} pts`
                : "Sin canjes"}
            </p>
            <p className="text-xs text-(--muted-foreground)">
              {lastRedemptionDistance ?? "Aún no canjeas puntos"}
            </p>
          </div>
        </div>
      </Reveal>

      <Reveal
        id="cafeterias"
        className="rounded-3xl border border-white/15 bg-(--surface) p-8 shadow-(--shadow-card)"
      >
        <div className="flex flex-col gap-2">
          <div>
            <h2 className="text-xl font-semibold text-(--foreground)">
              Cafeterías Coffeefy
            </h2>
            <p className="text-sm text-(--muted-foreground)">
              Explora las sedes disponibles, revisa su carta y precios en tiempo
              real.
            </p>
          </div>
          {localsError ? (
            <div className="mt-2 flex flex-wrap items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <span>{localsError}</span>
              <button
                type="button"
                onClick={handleRefreshLocals}
                className="rounded-full border border-red-300 px-4 py-1 text-xs font-semibold text-red-700 transition hover:border-red-400 hover:text-red-800"
              >
                Reintentar
              </button>
            </div>
          ) : null}
        </div>

        {localsLoading ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <div
                key={index}
                className="animate-pulse rounded-3xl border border-white/10 bg-(--surface-alt) p-6"
              >
                <div className="h-40 w-full rounded-2xl bg-(--surface)" />
                <div className="mt-4 h-4 w-2/3 rounded bg-(--surface)" />
                <div className="mt-2 h-3 w-full rounded bg-(--surface)" />
                <div className="mt-2 h-3 w-3/4 rounded bg-(--surface)" />
              </div>
            ))}
          </div>
        ) : locals.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-white/20 bg-(--surface-alt) p-6 text-sm text-(--muted-foreground)">
            Aún no hay cafeterías registradas. Vuelve pronto para conocer nuevas
            sedes.
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {locals.map((local) => {
              const isExpanded = expandedLocals.includes(local.id);
              const highlightItems = splitHighlights(local.highlights ?? "");
              const catalog = catalogs[local.id] ?? null;
              const isCatalogLoading = Boolean(catalogLoading[local.id]);
              const catalogError = catalogErrors[local.id];
              const groups = catalog ? groupProductsByCategory(catalog) : [];
              const pointsRate = Number.isFinite(local.points_rate)
                ? Math.max(Math.round(local.points_rate * 1000), 0)
                : 0;

              return (
                <article
                  key={local.id}
                  className="hover-glow flex flex-col gap-5 rounded-3xl border border-white/12 bg-(--surface-alt) p-6 shadow-(--shadow-card)"
                >
                  {local.cover_image_url ? (
                    <div className="overflow-hidden rounded-2xl border border-white/10">
                      <Image
                        src={local.cover_image_url}
                        alt={`Foto de ${local.name}`}
                        width={1200}
                        height={720}
                        className="aspect-5/3 w-full object-cover"
                        sizes="(min-width: 1024px) 600px, 100vw"
                        priority={false}
                      />
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-(--accent)/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-(--accent)">
                          {localTypeLabels[local.type] ?? "Local"}
                        </span>
                        {local.tag_details?.slice(0, 3).map((tag) => (
                          <span
                            key={tag.id}
                            className="rounded-full border border-white/15 px-3 py-1 text-xs font-medium text-(--muted-foreground)"
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-xl font-semibold text-(--foreground)">
                          {local.name}
                        </h3>
                        {local.headline ? (
                          <p className="text-sm text-(--muted-foreground)">
                            {local.headline}
                          </p>
                        ) : null}
                      </div>
                      {highlightItems.length > 0 ? (
                        <ul className="grid gap-1 text-sm text-(--muted-foreground) sm:grid-cols-2">
                          {highlightItems.map((item, index) => (
                            <li key={`${local.id}-highlight-${index}`}>
                              • {item}
                            </li>
                          ))}
                        </ul>
                      ) : local.description ? (
                        <p className="text-sm text-(--muted-foreground)">
                          {local.description}
                        </p>
                      ) : null}
                      <div className="space-y-1 text-xs text-(--muted-foreground)">
                        <p>📍 {local.address}</p>
                        {local.schedule ? <p>🕒 {local.schedule}</p> : null}
                        <p>🎯 Acumulas {pointsRate} pts por cada $1.000</p>
                      </div>
                    </div>

                    <div className="flex w-full max-w-xs flex-col gap-2 text-sm">
                      {local.website_url ? (
                        <a
                          href={local.website_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border border-white/15 px-4 py-2 text-center font-semibold text-(--muted-foreground) transition hover:border-(--accent) hover:text-(--accent)"
                        >
                          Sitio web
                        </a>
                      ) : null}
                      {local.instagram_url ? (
                        <a
                          href={local.instagram_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border border-white/15 px-4 py-2 text-center font-semibold text-(--muted-foreground) transition hover:border-(--accent) hover:text-(--accent)"
                        >
                          Instagram
                        </a>
                      ) : null}
                      {local.contact_phone ? (
                        <a
                          href={`tel:${local.contact_phone}`}
                          className="rounded-full border border-white/15 px-4 py-2 text-center font-semibold text-(--muted-foreground) transition hover:border-(--accent) hover:text-(--accent)"
                        >
                          Llamar
                        </a>
                      ) : null}
                      {local.map_url ? (
                        <a
                          href={local.map_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border border-white/15 px-4 py-2 text-center font-semibold text-(--muted-foreground) transition hover:border-(--accent) hover:text-(--accent)"
                        >
                          Ver mapa
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => handleToggleLocal(local.id)}
                        className="rounded-full border border-white/20 px-4 py-2 text-center text-sm font-semibold text-(--foreground) transition hover:border-(--accent) hover:text-(--accent)"
                      >
                        {isExpanded ? "Ocultar menú" : "Ver menú"}
                      </button>
                    </div>
                  </div>

                  {isExpanded ? (
                    <div className="border-t border-white/10 pt-5">
                      {isCatalogLoading ? (
                        <div className="grid gap-3 md:grid-cols-2">
                          {Array.from({ length: 4 }).map((_, index) => (
                            <div
                              key={index}
                              className="animate-pulse rounded-2xl border border-white/10 bg-(--surface) p-4"
                            >
                              <div className="h-4 w-2/3 rounded bg-(--surface-alt)" />
                              <div className="mt-3 h-3 w-full rounded bg-(--surface-alt)" />
                              <div className="mt-2 h-3 w-3/4 rounded bg-(--surface-alt)" />
                            </div>
                          ))}
                        </div>
                      ) : catalogError ? (
                        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                          <div className="flex flex-wrap items-center gap-3">
                            <span>{catalogError}</span>
                            <button
                              type="button"
                              onClick={() => loadCatalog(local.id)}
                              className="rounded-full border border-red-300 px-4 py-1 text-xs font-semibold text-red-700 transition hover:border-red-400 hover:text-red-800"
                            >
                              Reintentar
                            </button>
                          </div>
                        </div>
                      ) : groups.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-white/20 bg-(--surface) p-6 text-sm text-(--muted-foreground)">
                          Este local está preparando su carta digital. Vuelve
                          pronto para verla completa.
                        </div>
                      ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                          {groups.map((group) => (
                            <div
                              key={`${local.id}-${
                                group.categoryId ?? "sin-categoria"
                              }`}
                              className="rounded-2xl border border-white/10 bg-(--surface) p-5"
                            >
                              <h4 className="text-base font-semibold text-(--foreground)">
                                {group.categoryName}
                              </h4>
                              <div className="mt-3 space-y-3">
                                {group.items.map((product) => (
                                  <div
                                    key={product.id}
                                    className="border-b border-white/10 pb-3 last:border-b-0 last:pb-0"
                                  >
                                    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                                      <span className="text-sm font-semibold text-(--foreground)">
                                        {product.name}
                                      </span>
                                      <span className="text-sm font-semibold text-(--accent)">
                                        {formatCurrency(product.price)}
                                      </span>
                                    </div>
                                    {product.description ? (
                                      <p className="text-xs text-(--muted-foreground)">
                                        {product.description}
                                      </p>
                                    ) : null}
                                    {!product.in_stock ||
                                    product.stock_state === "out" ? (
                                      <p className="mt-1 text-xs font-semibold text-red-500">
                                        Sin stock temporalmente
                                      </p>
                                    ) : null}
                                    {product.state &&
                                    product.state !== "normal" ? (
                                      <p className="mt-1 text-xs font-semibold uppercase text-amber-500">
                                        {product.state === "recien_tostado"
                                          ? "Recién tostado"
                                          : product.state === "promocion"
                                          ? "En promoción"
                                          : product.state}
                                      </p>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </Reveal>

      <Reveal className="rounded-3xl border border-white/15 bg-(--surface) p-8 shadow-(--shadow-card)">
        <div className="flex flex-col gap-2">
          <div>
            <h2 className="text-xl font-semibold text-(--foreground)">
              Balances por local
            </h2>
            <p className="text-sm text-(--muted-foreground)">
              Revisa cuántos puntos tienes en cada local participante.
            </p>
          </div>
          <div className="mt-4 divide-y divide-white/10 rounded-2xl border border-white/10">
            {balances.length === 0 ? (
              <div className="p-4 text-sm text-(--muted-foreground)">
                Todavía no tienes puntos acumulados. Visita un local para
                comenzar.
              </div>
            ) : (
              balances.map((balance) => {
                const updated = safeParse(balance.updated_at);
                return (
                  <div
                    key={balance.id}
                    className="flex items-center justify-between px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-semibold text-(--foreground)">
                        {balance.local_name}
                      </p>
                      <p className="text-xs text-(--muted-foreground)">
                        {formatNumber(balance.total)} pts disponibles
                      </p>
                    </div>
                    <p className="text-xs text-(--muted-foreground)">
                      Actualizado{" "}
                      {updated
                        ? format(updated, "dd MMM HH:mm", { locale: es })
                        : "recientemente"}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Reveal>

      <Reveal
        id="recompensas"
        className="rounded-3xl border border-white/15 bg-(--surface) p-8 shadow-(--shadow-card)"
      >
        <div className="flex flex-col gap-2">
          <div>
            <h2 className="text-xl font-semibold text-(--foreground)">
              Recompensas disponibles
            </h2>
            <p className="text-sm text-(--muted-foreground)">
              Usa tus puntos en las recompensas activas por local.
            </p>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rewards.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/20 bg-(--surface-alt) p-6 text-sm text-(--muted-foreground)">
                No hay recompensas activas para esta vista. Revisa más tarde.
              </div>
            ) : (
              rewards.map((reward) => (
                <article
                  key={reward.id}
                  className="hover-glow flex flex-col gap-3 rounded-2xl border border-white/10 bg-(--surface-alt) p-6 text-sm text-(--muted-foreground) shadow-(--shadow-card)"
                >
                  <div>
                    <p className="text-xs uppercase tracking-wide text-(--muted-foreground)">
                      {reward.local_name}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-(--foreground)">
                      {reward.name}
                    </h3>
                    {reward.description ? (
                      <p className="mt-2 text-sm text-(--muted-foreground)">
                        {reward.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-(--foreground)">
                      {formatNumber(reward.points_required)} pts
                    </span>
                    <span className="text-xs text-(--muted-foreground)">
                      {formatNumber(reward.redemption_count)} canjes
                    </span>
                  </div>
                  <button
                    type="button"
                    className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-(--muted-foreground) transition hover:border-(--accent) hover:text-(--accent)"
                    disabled
                  >
                    Próximamente
                  </button>
                </article>
              ))
            )}
          </div>
        </div>
      </Reveal>

      <Reveal
        id="historial"
        className="rounded-3xl border border-white/15 bg-(--surface) p-8 shadow-(--shadow-card)"
      >
        <div className="flex flex-col gap-2">
          <div>
            <h2 className="text-xl font-semibold text-(--foreground)">
              Historial de canjes
            </h2>
            <p className="text-sm text-(--muted-foreground)">
              Tus últimos movimientos dentro de los últimos{" "}
              {REDEMPTION_WINDOW_DAYS} días.
            </p>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {redemptions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/20 bg-(--surface-alt) p-6 text-sm text-(--muted-foreground)">
                Aún no registras canjes recientes.
              </div>
            ) : (
              redemptions.map((redemption) => {
                const created = safeParse(redemption.created_at);
                const relative = created
                  ? formatDistanceToNow(created, {
                      addSuffix: true,
                      locale: es,
                    })
                  : "";
                return (
                  <div
                    key={redemption.id}
                    className="rounded-2xl border border-white/12 bg-(--surface-alt) p-5 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-(--foreground)">
                        {redemption.reward_name ?? "Recompensa manual"}
                      </p>
                      <span className="text-xs text-(--muted-foreground)">
                        {relative}
                      </span>
                    </div>
                    <p className="mt-1 text-(--muted-foreground)">
                      {redemption.local_name}
                    </p>
                    <p className="mt-2 text-xs text-(--muted-foreground)">
                      {formatNumber(redemption.points_used)} pts canjeados
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Reveal>
    </div>
  );
}
