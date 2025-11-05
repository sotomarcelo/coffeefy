"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Reveal } from "@/components/reveal";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch, ApiError } from "@/lib/api";

const WINDOW_OPTIONS = [7, 30, 90];

type Local = {
  id: number;
  name: string;
  owner: number;
  owner_name: string;
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

type LoyaltySummary = {
  total_points: number;
  active_customers: number;
  active_rewards: number;
  total_rewards: number;
  redemptions_last_window: number;
  points_redeemed_last_window: number;
  top_customers: Array<{
    user_id: number;
    user_name: string;
    local_id: number;
    local_name: string;
    total_points: number;
  }>;
  top_rewards: Array<{
    reward_id: number;
    reward_name: string;
    redemptions: number;
  }>;
  generated_at: string;
  window_days: number;
};

type AdjustFormState = {
  username: string;
  delta: string;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-CL").format(value);
}

export default function LoyaltyDashboardPage() {
  const { user, accessToken } = useAuth();
  const [locals, setLocals] = useState<Local[]>([]);
  const [selectedLocalId, setSelectedLocalId] = useState<number | "all">("all");
  const [windowDays, setWindowDays] = useState<number>(30);
  const [summary, setSummary] = useState<LoyaltySummary | null>(null);
  const [balances, setBalances] = useState<PointBalance[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adjustForm, setAdjustForm] = useState<AdjustFormState>({
    username: "",
    delta: "",
  });
  const [adjusting, setAdjusting] = useState(false);
  const [adjustFeedback, setAdjustFeedback] = useState<string | null>(null);

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

        const summaryParams = new URLSearchParams(baseParams);
        summaryParams.set("since_days", String(windowDays));
        const balancesParams = new URLSearchParams(baseParams);
        balancesParams.set("limit", "15");
        balancesParams.set("ordering", "-total");
        const rewardsParams = new URLSearchParams(baseParams);
        rewardsParams.set("ordering", "points_required,name");
        const redemptionsParams = new URLSearchParams(baseParams);
        redemptionsParams.set("since_days", String(windowDays));
        redemptionsParams.set("limit", "10");

        const [
          summaryResponse,
          balancesResponse,
          rewardsResponse,
          redemptionsResponse,
        ] = await Promise.all([
          apiFetch<LoyaltySummary>(
            `/api/points/summary/${
              summaryParams.toString() ? `?${summaryParams.toString()}` : ""
            }`,
            { token: accessToken ?? undefined }
          ),
          apiFetch<PointBalance[]>(
            `/api/points/${
              balancesParams.toString() ? `?${balancesParams.toString()}` : ""
            }`,
            { token: accessToken ?? undefined }
          ),
          apiFetch<Reward[]>(
            `/api/rewards/${
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

        setSummary(summaryResponse);
        setBalances(balancesResponse);
        setRewards(rewardsResponse);
        setRedemptions(redemptionsResponse);
      } catch (err) {
        console.error(err);
        const message =
          err instanceof ApiError && err.details
            ? typeof err.details === "string"
              ? err.details
              : "No pudimos cargar los datos de lealtad."
            : "No pudimos cargar los datos de lealtad.";
        setError(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [accessToken, selectedLocalId, windowDays]
  );

  useEffect(() => {
    if (!user || !accessToken) return;
    fetchData({ initial: true });
  }, [user, accessToken, fetchData]);

  const handleRefresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleReward = useCallback(
    async (reward: Reward) => {
      if (!accessToken) return;
      try {
        await apiFetch<Reward>(`/api/rewards/${reward.id}/toggle/`, {
          method: "POST",
          token: accessToken ?? undefined,
        });
        fetchData();
      } catch (err) {
        console.error(err);
        const message =
          err instanceof ApiError && err.details
            ? typeof err.details === "string"
              ? err.details
              : "No se pudo actualizar la recompensa."
            : "No se pudo actualizar la recompensa.";
        setError(message);
      }
    },
    [accessToken, fetchData]
  );

  const handleAdjustPoints = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!accessToken) return;
      if (selectedLocalId === "all") {
        setAdjustFeedback("Selecciona un local para ajustar puntos.");
        return;
      }

      const username = adjustForm.username.trim();
      const deltaValue = Number.parseInt(adjustForm.delta, 10);
      if (!username || Number.isNaN(deltaValue)) {
        setAdjustFeedback("Completa usuario y puntos a ajustar.");
        return;
      }

      setAdjustFeedback(null);
      setAdjusting(true);
      try {
        await apiFetch<PointBalance>("/api/points/adjust/", {
          method: "POST",
          token: accessToken ?? undefined,
          body: {
            local: selectedLocalId,
            username,
            delta: deltaValue,
          },
        });
        setAdjustFeedback("Puntos actualizados correctamente.");
        setAdjustForm({ username: "", delta: "" });
        fetchData();
      } catch (err) {
        console.error(err);
        const message =
          err instanceof ApiError && err.details
            ? typeof err.details === "string"
              ? err.details
              : "No se pudo ajustar el saldo."
            : "No se pudo ajustar el saldo.";
        setAdjustFeedback(message);
      } finally {
        setAdjusting(false);
      }
    },
    [accessToken, adjustForm, fetchData, selectedLocalId]
  );

  const lastUpdatedLabel = useMemo(() => {
    if (!summary?.generated_at) return null;
    const parsed = parseISO(summary.generated_at);
    if (Number.isNaN(parsed.getTime())) return null;
    return formatDistanceToNow(parsed, { addSuffix: true, locale: es });
  }, [summary]);

  if (!user) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4 rounded-3xl border border-white/15 bg-(--surface) p-10 text-center shadow-(--shadow-card)">
        <h1 className="text-2xl font-semibold text-(--foreground)">
          Inicia sesión para administrar la lealtad
        </h1>
        <p className="text-(--muted-foreground)">
          Necesitas ingresar a Coffeefy para ver balances, recompensas y canjes.
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
              Lealtad y recompensas
            </h1>
            <p className="text-sm text-(--muted-foreground)">
              Observa puntos acumulados, recompensas activas y canjes recientes
              por local.
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
                value={windowDays}
                onChange={(event) => setWindowDays(Number(event.target.value))}
                className="mt-1 w-full rounded-xl border border-white/20 bg-(--surface-alt) px-4 py-2 text-sm text-(--foreground) shadow-sm focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
              >
                {WINDOW_OPTIONS.map((days) => (
                  <option key={days} value={days}>
                    Últimos {days} días
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

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-(--surface-alt) p-4">
            <p className="text-xs uppercase tracking-wide text-(--muted-foreground)">
              Puntos acumulados
            </p>
            <p className="mt-2 text-3xl font-semibold text-(--foreground)">
              {summary ? formatNumber(summary.total_points) : "—"}
            </p>
            <p className="text-xs text-(--muted-foreground)">
              {selectedLocalId === "all"
                ? "Todos los locales"
                : "Saldo agregado"}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-(--surface-alt) p-4">
            <p className="text-xs uppercase tracking-wide text-(--muted-foreground)">
              Clientes activos
            </p>
            <p className="mt-2 text-3xl font-semibold text-blue-500">
              {summary ? formatNumber(summary.active_customers) : "—"}
            </p>
            <p className="text-xs text-(--muted-foreground)">
              Con saldo en los últimos {summary?.window_days ?? windowDays} días
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-(--surface-alt) p-4">
            <p className="text-xs uppercase tracking-wide text-(--muted-foreground)">
              Canjes recientes
            </p>
            <p className="mt-2 text-3xl font-semibold text-emerald-500">
              {summary ? formatNumber(summary.redemptions_last_window) : "—"}
            </p>
            <p className="text-xs text-(--muted-foreground)">
              {summary
                ? `${formatNumber(
                    summary.points_redeemed_last_window
                  )} pts canjeados`
                : "Pts canjeados en la ventana"}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-(--surface-alt) p-4">
            <p className="text-xs uppercase tracking-wide text-(--muted-foreground)">
              Recompensas activas
            </p>
            <p className="mt-2 text-3xl font-semibold text-yellow-500">
              {summary ? formatNumber(summary.active_rewards) : "—"}
            </p>
            <p className="text-xs text-(--muted-foreground)">
              De {summary ? formatNumber(summary.total_rewards) : "—"} totales
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-(--surface-alt) p-4">
            <p className="text-xs uppercase tracking-wide text-(--muted-foreground)">
              Top clientes
            </p>
            <div className="mt-2 space-y-1 text-sm text-(--foreground)">
              {summary?.top_customers.length ? (
                summary.top_customers.map((customer) => (
                  <div
                    key={`${customer.user_id}-${customer.local_id}`}
                    className="flex items-center justify-between"
                  >
                    <span>{customer.user_name}</span>
                    <span className="text-(--muted-foreground)">
                      {formatNumber(customer.total_points)} pts
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-(--muted-foreground)">
                  Sin datos disponibles
                </p>
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-(--surface-alt) p-4">
            <p className="text-xs uppercase tracking-wide text-(--muted-foreground)">
              Recompensas destacadas
            </p>
            <div className="mt-2 space-y-1 text-sm text-(--foreground)">
              {summary?.top_rewards.length ? (
                summary.top_rewards.map((reward) => (
                  <div
                    key={reward.reward_id ?? reward.reward_name}
                    className="flex items-center justify-between"
                  >
                    <span>{reward.reward_name ?? "Recompensa sin nombre"}</span>
                    <span className="text-(--muted-foreground)">
                      {formatNumber(reward.redemptions)} canjes
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-(--muted-foreground)">
                  Sin datos disponibles
                </p>
              )}
            </div>
          </div>
        </div>
      </Reveal>

      <Reveal className="rounded-3xl border border-white/15 bg-(--surface) p-8 shadow-(--shadow-card)">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-(--foreground)">
              Balances de puntos
            </h2>
            <p className="text-sm text-(--muted-foreground)">
              Los 15 clientes con más puntos en este alcance.
            </p>
            <div className="mt-4 divide-y divide-white/10 rounded-2xl border border-white/10">
              {balances.length === 0 ? (
                <div className="p-4 text-sm text-(--muted-foreground)">
                  No hay balances registrados para esta vista.
                </div>
              ) : (
                balances.map((balance) => (
                  <div
                    key={balance.id}
                    className="flex items-center justify-between px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-semibold text-(--foreground)">
                        {balance.user_name}
                      </p>
                      <p className="text-xs text-(--muted-foreground)">
                        {balance.local_name} · {formatNumber(balance.total)} pts
                      </p>
                    </div>
                    <p className="text-xs text-(--muted-foreground)">
                      Actualizado{" "}
                      {format(parseISO(balance.updated_at), "dd MMM HH:mm", {
                        locale: es,
                      })}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-(--surface-alt) p-6">
            <h3 className="text-lg font-semibold text-(--foreground)">
              Ajustar puntos
            </h3>
            <p className="mt-1 text-xs text-(--muted-foreground)">
              Añade o descuenta puntos manualmente a un cliente del local
              seleccionado.
            </p>
            <form className="mt-4 space-y-3" onSubmit={handleAdjustPoints}>
              <label className="block text-xs font-semibold uppercase tracking-wide text-(--muted-foreground)">
                Usuario
                <input
                  type="text"
                  value={adjustForm.username}
                  onChange={(event) =>
                    setAdjustForm((prev) => ({
                      ...prev,
                      username: event.target.value,
                    }))
                  }
                  placeholder="usuario"
                  className="mt-1 w-full rounded-xl border border-white/20 bg-(--surface) px-4 py-2 text-sm text-(--foreground) focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
                />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wide text-(--muted-foreground)">
                Puntos
                <input
                  type="number"
                  value={adjustForm.delta}
                  onChange={(event) =>
                    setAdjustForm((prev) => ({
                      ...prev,
                      delta: event.target.value,
                    }))
                  }
                  placeholder="Ej. 150 o -50"
                  className="mt-1 w-full rounded-xl border border-white/20 bg-(--surface) px-4 py-2 text-sm text-(--foreground) focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
                />
              </label>
              {adjustFeedback ? (
                <p className="text-xs text-(--muted-foreground)">
                  {adjustFeedback}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={adjusting || selectedLocalId === "all"}
                className="w-full rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-(--foreground) transition hover:border-(--accent) hover:text-(--accent) disabled:cursor-not-allowed disabled:opacity-60"
              >
                {adjusting ? "Guardando…" : "Aplicar"}
              </button>
            </form>
          </div>
        </div>
      </Reveal>

      <Reveal className="rounded-3xl border border-white/15 bg-(--surface) p-8 shadow-(--shadow-card)">
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-(--foreground)">
                Recompensas
              </h2>
              <p className="text-sm text-(--muted-foreground)">
                Activa o pausa incentivos disponibles para tus clientes.
              </p>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-(--muted-foreground)">
                <tr>
                  <th className="px-4 py-2 font-semibold">Nombre</th>
                  <th className="px-4 py-2 font-semibold">Puntos</th>
                  <th className="px-4 py-2 font-semibold">Canjes</th>
                  <th className="px-4 py-2 font-semibold">Estado</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {rewards.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-6 text-center text-sm text-(--muted-foreground)"
                    >
                      No hay recompensas registradas para esta vista.
                    </td>
                  </tr>
                ) : (
                  rewards.map((reward) => (
                    <tr key={reward.id} className="text-(--foreground)">
                      <td className="px-4 py-3">
                        <div className="font-semibold">{reward.name}</div>
                        {reward.description ? (
                          <p className="text-xs text-(--muted-foreground)">
                            {reward.description}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-sm text-(--muted-foreground)">
                        {formatNumber(reward.points_required)} pts
                      </td>
                      <td className="px-4 py-3 text-sm text-(--muted-foreground)">
                        {formatNumber(reward.redemption_count)} canjes
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                            reward.active
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-gray-200 text-gray-600"
                          }`}
                        >
                          {reward.active ? "Activa" : "Pausada"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleToggleReward(reward)}
                          className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-(--muted-foreground) transition hover:border-(--accent) hover:text-(--accent)"
                        >
                          {reward.active ? "Pausar" : "Reactivar"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Reveal>

      <Reveal className="rounded-3xl border border-white/15 bg-(--surface) p-8 shadow-(--shadow-card)">
        <div className="flex flex-col gap-2">
          <div>
            <h2 className="text-xl font-semibold text-(--foreground)">
              Canjes recientes
            </h2>
            <p className="text-sm text-(--muted-foreground)">
              Últimos movimientos dentro de la ventana seleccionada.
            </p>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {redemptions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/20 bg-(--surface-alt) p-6 text-sm text-(--muted-foreground)">
                No existen canjes recientes para esta vista.
              </div>
            ) : (
              redemptions.map((redemption) => {
                const created = parseISO(redemption.created_at);
                const relative = Number.isNaN(created.getTime())
                  ? ""
                  : formatDistanceToNow(created, {
                      addSuffix: true,
                      locale: es,
                    });
                return (
                  <div
                    key={redemption.id}
                    className="rounded-2xl border border-white/12 bg-(--surface-alt) p-5 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-(--foreground)">
                        {redemption.user_name}
                      </p>
                      <span className="text-xs text-(--muted-foreground)">
                        {relative}
                      </span>
                    </div>
                    <p className="mt-1 text-(--muted-foreground)">
                      {redemption.reward_name ?? "Recompensa manual"}
                    </p>
                    <p className="mt-2 text-xs text-(--muted-foreground)">
                      {formatNumber(redemption.points_used)} pts ·{" "}
                      {redemption.local_name}
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
