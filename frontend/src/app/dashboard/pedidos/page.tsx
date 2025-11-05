"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  differenceInMinutes,
  format,
  formatDistanceToNow,
  isValid,
  parseISO,
} from "date-fns";
import { es } from "date-fns/locale";
import { Reveal } from "@/components/reveal";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch, ApiError } from "@/lib/api";

const ORDER_STATUSES = [
  "pendiente",
  "preparando",
  "listo",
  "completado",
  "cancelado",
] as const;

const STATUS_LABELS: Record<OrderStatus, string> = {
  pendiente: "Pendiente",
  preparando: "En preparación",
  listo: "Listo para retirar",
  completado: "Completado",
  cancelado: "Cancelado",
};

const STATUS_STYLES: Record<OrderStatus, string> = {
  pendiente: "bg-yellow-100 text-yellow-800",
  preparando: "bg-blue-100 text-blue-800",
  listo: "bg-emerald-100 text-emerald-800",
  completado: "bg-gray-200 text-gray-700",
  cancelado: "bg-red-100 text-red-700",
};

const NEXT_STATUS_OPTIONS: Record<OrderStatus, OrderStatus[]> = {
  pendiente: ["preparando", "cancelado"],
  preparando: ["listo", "cancelado"],
  listo: ["completado", "cancelado"],
  completado: [],
  cancelado: [],
};

const REFRESH_INTERVAL_MS = 30000;
const DEFAULT_SINCE_MINUTES = 240;

type OrderStatus = (typeof ORDER_STATUSES)[number];

type Local = {
  id: number;
  name: string;
  owner: number;
  owner_name: string;
};

type OrderItem = {
  id: number;
  product: number;
  product_name: string;
  quantity: number;
  unit_price: string;
};

type Order = {
  id: number;
  user_name: string;
  local: number;
  local_name: string;
  status: OrderStatus;
  status_display: string;
  total: string;
  pickup_code: string;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
};

type RawSummaryCounts = Record<string, number>;

type OrderSummary = {
  total: number;
  counts: Record<OrderStatus, number>;
  active_total: number;
  oldest_pending_minutes: number | null;
  average_preparation_minutes: number | null;
  average_completion_minutes: number | null;
  generated_at: string;
};

function ensureSummaryCounts(
  rawCounts: RawSummaryCounts
): Record<OrderStatus, number> {
  return ORDER_STATUSES.reduce((acc, status) => {
    acc[status] = rawCounts?.[status] ?? 0;
    return acc;
  }, {} as Record<OrderStatus, number>);
}

function safeParse(dateString: string) {
  const parsed = parseISO(dateString);
  return isValid(parsed) ? parsed : null;
}

function formatCurrency(amount: string) {
  const numeric = Number(amount);
  if (Number.isNaN(numeric)) return amount;
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
  }).format(numeric);
}

function formatMinutes(minutes: number | null | undefined) {
  if (minutes === null || minutes === undefined) return "—";
  if (minutes < 1) return "<1 min";
  if (minutes < 90) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  return `${hours.toFixed(1)} h`;
}

export default function OrdersOperationsPage() {
  const { user, accessToken } = useAuth();
  const [locals, setLocals] = useState<Local[]>([]);
  const [selectedLocalId, setSelectedLocalId] = useState<number | "all">("all");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "active">(
    "active"
  );
  const [sinceMinutes, setSinceMinutes] = useState(DEFAULT_SINCE_MINUTES);
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<OrderSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);
  const pollRef = useRef<number | null>(null);

  const myLocals = useMemo(() => {
    if (!user) return locals;
    return locals.filter((local) => local.owner_name === user.username);
  }, [locals, user]);

  useEffect(() => {
    if (!user || !accessToken) {
      setLoading(false);
      return;
    }

    const fetchLocals = async () => {
      try {
        const response = await apiFetch<Local[]>("/api/locals/", {
          token: accessToken ?? undefined,
        });
        setLocals(response);
        if (response.length === 1) {
          setSelectedLocalId(response[0].id);
        }
      } catch (err) {
        console.error(err);
        const message =
          err instanceof ApiError && err.details
            ? typeof err.details === "string"
              ? err.details
              : "No pudimos cargar los locales."
            : "No pudimos cargar los locales.";
        setError(message);
      }
    };

    fetchLocals();
  }, [user, accessToken]);

  const fetchData = useCallback(
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
        if (sinceMinutes) {
          baseParams.set("since", String(sinceMinutes));
        }

        const summaryQuery = baseParams.toString();
        const summaryUrl = `/api/orders/summary/${
          summaryQuery ? `?${summaryQuery}` : ""
        }`;

        let ordersUrl = "";
        if (statusFilter === "active") {
          const activeParams = new URLSearchParams(baseParams);
          const activeQuery = activeParams.toString();
          ordersUrl = `/api/orders/active/${
            activeQuery ? `?${activeQuery}` : ""
          }`;
        } else {
          const specificParams = new URLSearchParams(baseParams);
          specificParams.set("status", statusFilter);
          specificParams.set("ordering", "created_at");
          const ordersQuery = specificParams.toString();
          ordersUrl = `/api/orders/?${ordersQuery}`;
        }

        const [summaryResponse, ordersResponse] = await Promise.all([
          apiFetch<{
            total: number;
            counts: RawSummaryCounts;
            active_total: number;
            oldest_pending_minutes: number | null;
            average_preparation_minutes: number | null;
            average_completion_minutes: number | null;
            generated_at: string;
          }>(summaryUrl, {
            token: accessToken ?? undefined,
          }),
          apiFetch<Order[]>(ordersUrl, {
            token: accessToken ?? undefined,
          }),
        ]);

        setSummary({
          total: summaryResponse.total,
          counts: ensureSummaryCounts(summaryResponse.counts),
          active_total: summaryResponse.active_total,
          oldest_pending_minutes: summaryResponse.oldest_pending_minutes,
          average_preparation_minutes:
            summaryResponse.average_preparation_minutes,
          average_completion_minutes:
            summaryResponse.average_completion_minutes,
          generated_at: summaryResponse.generated_at,
        });
        setOrders(ordersResponse);
      } catch (err) {
        console.error(err);
        const message =
          err instanceof ApiError && err.details
            ? typeof err.details === "string"
              ? err.details
              : "No pudimos cargar los pedidos."
            : "No pudimos cargar los pedidos.";
        setError(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [accessToken, selectedLocalId, sinceMinutes, statusFilter]
  );

  useEffect(() => {
    if (!user || !accessToken) return;
    fetchData({ initial: true });
  }, [user, accessToken, fetchData]);

  useEffect(() => {
    if (!accessToken) return undefined;
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
    }
    pollRef.current = window.setInterval(() => {
      fetchData();
    }, REFRESH_INTERVAL_MS);

    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
      }
    };
  }, [accessToken, fetchData]);

  const handleRefresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  const handleStatusUpdate = useCallback(
    async (order: Order, nextStatus: OrderStatus) => {
      if (!accessToken) return;
      setUpdatingOrderId(order.id);
      setError(null);
      try {
        await apiFetch<Order>(`/api/orders/${order.id}/update_status/`, {
          method: "POST",
          token: accessToken ?? undefined,
          body: { status: nextStatus },
        });
        await fetchData();
      } catch (err) {
        console.error(err);
        const message =
          err instanceof ApiError && err.details
            ? typeof err.details === "string"
              ? err.details
              : "No pudimos actualizar el pedido."
            : "No pudimos actualizar el pedido.";
        setError(message);
      } finally {
        setUpdatingOrderId(null);
      }
    },
    [accessToken, fetchData]
  );

  const selectedLocal = useMemo(() => {
    if (selectedLocalId === "all") return null;
    return locals.find((local) => local.id === selectedLocalId) ?? null;
  }, [locals, selectedLocalId]);

  const lastUpdatedLabel = useMemo(() => {
    if (!summary?.generated_at) return null;
    const parsed = safeParse(summary.generated_at);
    if (!parsed) return null;
    return formatDistanceToNow(parsed, { addSuffix: true, locale: es });
  }, [summary]);

  if (!user) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4 rounded-3xl border border-white/15 bg-(--surface) p-10 text-center shadow-(--shadow-card)">
        <h1 className="text-2xl font-semibold text-(--foreground)">
          Inicia sesión para gestionar pedidos
        </h1>
        <p className="text-(--muted-foreground)">
          Necesitas ingresar a Coffeefy para ver y actualizar los pedidos en
          curso.
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

      <Reveal className="rounded-3xl border border-white/15 bg-(--surface) p-8 shadow-(--shadow-card)">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-(--foreground)">
              Operaciones en vivo
            </h1>
            <p className="text-sm text-(--muted-foreground)">
              Controla pedidos activos, tiempos de preparación y estados en cada
              punto de venta.
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
                {myLocals.map((local) => (
                  <option key={local.id} value={local.id}>
                    {local.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-(--foreground)">
              Ventana
              <select
                value={sinceMinutes}
                onChange={(event) =>
                  setSinceMinutes(Number(event.target.value))
                }
                className="mt-1 w-full rounded-xl border border-white/20 bg-(--surface-alt) px-4 py-2 text-sm text-(--foreground) shadow-sm focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
              >
                <option value={60}>Última hora</option>
                <option value={120}>Últimas 2 h</option>
                <option value={240}>Últimas 4 h</option>
                <option value={480}>Últimas 8 h</option>
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
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-(--surface-alt) p-4">
            <p className="text-xs uppercase tracking-wide text-(--muted-foreground)">
              Pedidos activos
            </p>
            <p className="mt-2 text-3xl font-semibold text-(--foreground)">
              {summary?.active_total ?? orders.length}
            </p>
            <p className="text-xs text-(--muted-foreground)">
              {selectedLocal ? selectedLocal.name : "Todos los locales"}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-(--surface-alt) p-4">
            <p className="text-xs uppercase tracking-wide text-(--muted-foreground)">
              Pendientes en cola
            </p>
            <p className="mt-2 text-3xl font-semibold text-yellow-500">
              {summary?.counts.pendiente ?? 0}
            </p>
            <p className="text-xs text-(--muted-foreground)">
              {formatMinutes(summary?.oldest_pending_minutes)} en espera máxima
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-(--surface-alt) p-4">
            <p className="text-xs uppercase tracking-wide text-(--muted-foreground)">
              Prep. promedio
            </p>
            <p className="mt-2 text-3xl font-semibold text-blue-500">
              {formatMinutes(summary?.average_preparation_minutes)}
            </p>
            <p className="text-xs text-(--muted-foreground)">
              Estados pendiente → listo
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-(--surface-alt) p-4">
            <p className="text-xs uppercase tracking-wide text-(--muted-foreground)">
              Finalización promedio
            </p>
            <p className="mt-2 text-3xl font-semibold text-emerald-500">
              {formatMinutes(summary?.average_completion_minutes)}
            </p>
            <p className="text-xs text-(--muted-foreground)">
              Pedidos completados en la ventana
            </p>
          </div>
        </div>
      </Reveal>

      <Reveal className="rounded-3xl border border-white/15 bg-(--surface) p-8 shadow-(--shadow-card)">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-(--foreground)">
              Cola de pedidos
            </h2>
            <p className="text-sm text-(--muted-foreground)">
              Supervisión en tiempo real para la barra y cocina.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStatusFilter("active")}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                statusFilter === "active"
                  ? "bg-(--accent) text-white"
                  : "border border-white/20 text-(--muted-foreground) hover:border-(--accent) hover:text-(--accent)"
              }`}
            >
              Activos
            </button>
            {ORDER_STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                  statusFilter === status
                    ? "bg-(--accent) text-white"
                    : "border border-white/20 text-(--muted-foreground) hover:border-(--accent) hover:text-(--accent)"
                }`}
              >
                {STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-white/20 bg-(--surface-alt) p-8 text-center text-sm text-(--muted-foreground)">
            Sin pedidos en esta vista. Ajusta filtros o espera nuevas órdenes.
          </div>
        ) : (
          <div className="mt-6 grid gap-4">
            {orders.map((order) => {
              const created = safeParse(order.created_at);
              const elapsedMinutes = created
                ? differenceInMinutes(new Date(), created)
                : null;
              const elapsedLabel = created
                ? formatDistanceToNow(created, { addSuffix: true, locale: es })
                : "—";
              const updated = safeParse(order.updated_at);
              const lastUpdate = updated
                ? format(updated, "HH:mm", { locale: es })
                : "";
              const nextStatuses = NEXT_STATUS_OPTIONS[order.status];

              return (
                <div
                  key={order.id}
                  className="rounded-2xl border border-white/12 bg-(--surface-alt) p-6 shadow-(--shadow-card)"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-lg font-semibold text-(--foreground)">
                          #{order.id}
                        </span>
                        {order.pickup_code ? (
                          <span className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-(--muted-foreground)">
                            Código {order.pickup_code}
                          </span>
                        ) : null}
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            STATUS_STYLES[order.status]
                          }`}
                        >
                          {STATUS_LABELS[order.status]}
                        </span>
                      </div>
                      <p className="text-sm text-(--muted-foreground)">
                        Cliente: {order.user_name || "Sin usuario"}
                      </p>
                      <p className="text-xs text-(--muted-foreground)">
                        Ingresó {elapsedLabel} · Última actualización{" "}
                        {lastUpdate}
                      </p>
                      <p className="text-sm font-semibold text-(--foreground)">
                        {formatCurrency(order.total)}
                      </p>
                      <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-(--muted-foreground)">
                        {order.items.map((item) => (
                          <li key={item.id}>
                            {item.quantity} × {item.product_name}
                          </li>
                        ))}
                      </ul>
                      {elapsedMinutes !== null && elapsedMinutes > 10 ? (
                        <p className="text-xs font-semibold text-yellow-500">
                          {elapsedMinutes} minutos en cola
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-col gap-2 md:items-end">
                      {nextStatuses.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {nextStatuses.map((nextStatus) => (
                            <button
                              key={nextStatus}
                              type="button"
                              disabled={updatingOrderId === order.id}
                              onClick={() =>
                                handleStatusUpdate(order, nextStatus)
                              }
                              className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                                nextStatus === "cancelado"
                                  ? "border border-red-200 text-red-600 hover:border-red-400 hover:text-red-500"
                                  : "bg-(--accent) text-white hover:bg-(--accent-dark)"
                              } disabled:cursor-not-allowed disabled:opacity-60`}
                            >
                              {nextStatus === "cancelado"
                                ? "Cancelar"
                                : `Marcar ${STATUS_LABELS[
                                    nextStatus
                                  ].toLowerCase()}`}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-(--muted-foreground)">
                          Sin acciones disponibles
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Reveal>
    </div>
  );
}
