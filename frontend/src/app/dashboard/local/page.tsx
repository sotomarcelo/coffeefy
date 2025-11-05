"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Reveal } from "@/components/reveal";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch, ApiError } from "@/lib/api";

const WEEK_DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

type WeekDay = (typeof WEEK_DAYS)[number];

const DAY_LABELS: Record<WeekDay, string> = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miércoles",
  thursday: "Jueves",
  friday: "Viernes",
  saturday: "Sábado",
  sunday: "Domingo",
};

type Tag = {
  id: number;
  name: string;
  slug: string;
  scope: "general" | "product" | "local";
  description?: string;
  icon?: string;
  accent_color?: string;
};

type DayHours = {
  open: string;
  close: string;
  closed: boolean;
};

type OpeningHours = Record<WeekDay, DayHours>;

type LocalProfile = {
  id: number;
  owner: number;
  owner_name: string;
  name: string;
  description: string;
  headline?: string;
  highlights?: string;
  address: string;
  schedule?: string;
  opening_hours?: Record<string, unknown> | null;
  special_hours?: unknown;
  timezone?: string | null;
  type: string;
  points_rate: number;
  qr_code_url?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  whatsapp_number?: string | null;
  website_url?: string | null;
  reservation_url?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  tiktok_url?: string | null;
  map_url?: string | null;
  map_embed_code?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  wifi_network?: string | null;
  wifi_password?: string | null;
  amenities_note?: string | null;
  cover_image_url?: string | null;
  gallery_urls?: string[] | null;
  tags?: number[];
  tag_details?: Tag[];
  created_at: string;
  updated_at: string;
};

type BasicFormState = {
  name: string;
  headline: string;
  description: string;
  highlights: string;
  address: string;
  qr_code_url: string;
  amenities_note: string;
  cover_image_url: string;
  gallery_text: string;
};

type ContactFormState = {
  contact_phone: string;
  contact_email: string;
  whatsapp_number: string;
  website_url: string;
  reservation_url: string;
  facebook_url: string;
  instagram_url: string;
  tiktok_url: string;
};

type LocationFormState = {
  map_url: string;
  map_embed_code: string;
  latitude: string;
  longitude: string;
};

type WifiFormState = {
  wifi_network: string;
  wifi_password: string;
};

function buildDefaultOpeningHours(): OpeningHours {
  const defaults: OpeningHours = {
    monday: { open: "08:00", close: "20:00", closed: false },
    tuesday: { open: "08:00", close: "20:00", closed: false },
    wednesday: { open: "08:00", close: "20:00", closed: false },
    thursday: { open: "08:00", close: "20:00", closed: false },
    friday: { open: "08:00", close: "20:00", closed: false },
    saturday: { open: "09:00", close: "18:00", closed: false },
    sunday: { open: "09:00", close: "16:00", closed: true },
  };
  return defaults;
}

function normalizeOpeningHours(value: unknown): OpeningHours {
  const base = buildDefaultOpeningHours();
  if (!value || typeof value !== "object") {
    return base;
  }

  WEEK_DAYS.forEach((day) => {
    const raw = (value as Record<string, unknown>)[day];
    if (raw && typeof raw === "object") {
      const cast = raw as Partial<DayHours>;
      base[day] = {
        open:
          typeof cast.open === "string" && cast.open
            ? cast.open
            : base[day].open,
        close:
          typeof cast.close === "string" && cast.close
            ? cast.close
            : base[day].close,
        closed:
          typeof cast.closed === "boolean" ? cast.closed : Boolean(cast.closed),
      };
    }
  });

  return base;
}

function buildScheduleSummary(hours: OpeningHours): string {
  return WEEK_DAYS.map((day) => {
    const info = hours[day];
    if (!info || info.closed) {
      return `${DAY_LABELS[day]}: Cerrado`;
    }
    return `${DAY_LABELS[day]}: ${info.open} - ${info.close}`;
  }).join(" · ");
}

function splitGallery(value: string): string[] {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function LocalDashboardPage() {
  const { user, accessToken } = useAuth();
  const [locals, setLocals] = useState<LocalProfile[]>([]);
  const [selectedLocalId, setSelectedLocalId] = useState<number | null>(null);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [savingSection, setSavingSection] = useState<string | null>(null);

  const [basicForm, setBasicForm] = useState<BasicFormState>({
    name: "",
    headline: "",
    description: "",
    highlights: "",
    address: "",
    qr_code_url: "",
    amenities_note: "",
    cover_image_url: "",
    gallery_text: "",
  });
  const [contactForm, setContactForm] = useState<ContactFormState>({
    contact_phone: "",
    contact_email: "",
    whatsapp_number: "",
    website_url: "",
    reservation_url: "",
    facebook_url: "",
    instagram_url: "",
    tiktok_url: "",
  });
  const [locationForm, setLocationForm] = useState<LocationFormState>({
    map_url: "",
    map_embed_code: "",
    latitude: "",
    longitude: "",
  });
  const [wifiForm, setWifiForm] = useState<WifiFormState>({
    wifi_network: "",
    wifi_password: "",
  });
  const [openingHours, setOpeningHours] = useState<OpeningHours>(
    buildDefaultOpeningHours()
  );
  const [timezoneValue, setTimezoneValue] = useState("America/Santiago");
  const [newTagName, setNewTagName] = useState("");
  const [tagSaving, setTagSaving] = useState(false);
  const [tagError, setTagError] = useState<string | null>(null);
  const feedbackTimeoutRef = useRef<number | null>(null);

  const activeLocal = useMemo(
    () => locals.find((local) => local.id === selectedLocalId) ?? null,
    [locals, selectedLocalId]
  );

  useEffect(() => {
    if (!user || !accessToken) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [localsResponse, tagsResponse] = await Promise.all([
          apiFetch<LocalProfile[]>("/api/locals/", {
            token: accessToken ?? undefined,
          }),
          apiFetch<Tag[]>("/api/tags/?scope=local", {
            token: accessToken ?? undefined,
          }),
        ]);
        setLocals(localsResponse);
        setAvailableTags(
          [...tagsResponse].sort((a, b) => a.name.localeCompare(b.name))
        );
        setSelectedLocalId((prev) => prev ?? localsResponse[0]?.id ?? null);
      } catch (err) {
        console.error(err);
        const message =
          err instanceof ApiError && err.details
            ? typeof err.details === "string"
              ? err.details
              : "No pudimos cargar la información del local."
            : "No pudimos cargar la información del local.";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, accessToken]);

  useEffect(() => {
    if (!activeLocal) {
      return;
    }

    setBasicForm({
      name: activeLocal.name ?? "",
      headline: activeLocal.headline ?? "",
      description: activeLocal.description ?? "",
      highlights: activeLocal.highlights ?? "",
      address: activeLocal.address ?? "",
      qr_code_url: activeLocal.qr_code_url ?? "",
      amenities_note: activeLocal.amenities_note ?? "",
      cover_image_url: activeLocal.cover_image_url ?? "",
      gallery_text: (activeLocal.gallery_urls ?? []).join("\n"),
    });

    setContactForm({
      contact_phone: activeLocal.contact_phone ?? "",
      contact_email: activeLocal.contact_email ?? "",
      whatsapp_number: activeLocal.whatsapp_number ?? "",
      website_url: activeLocal.website_url ?? "",
      reservation_url: activeLocal.reservation_url ?? "",
      facebook_url: activeLocal.facebook_url ?? "",
      instagram_url: activeLocal.instagram_url ?? "",
      tiktok_url: activeLocal.tiktok_url ?? "",
    });

    setLocationForm({
      map_url: activeLocal.map_url ?? "",
      map_embed_code: activeLocal.map_embed_code ?? "",
      latitude:
        activeLocal.latitude !== null && activeLocal.latitude !== undefined
          ? String(activeLocal.latitude)
          : "",
      longitude:
        activeLocal.longitude !== null && activeLocal.longitude !== undefined
          ? String(activeLocal.longitude)
          : "",
    });

    setWifiForm({
      wifi_network: activeLocal.wifi_network ?? "",
      wifi_password: activeLocal.wifi_password ?? "",
    });

    setOpeningHours(normalizeOpeningHours(activeLocal.opening_hours ?? {}));
    setTimezoneValue(activeLocal.timezone ?? "America/Santiago");
  }, [activeLocal]);

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) {
        window.clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, []);

  const updateLocal = useCallback(
    async (
      localId: number,
      payload: Partial<LocalProfile>,
      section: string
    ) => {
      if (!accessToken) {
        setError("Tu sesión expiró. Inicia sesión nuevamente.");
        return;
      }

      setSavingSection(section);
      setError(null);
      try {
        const updated = await apiFetch<LocalProfile>(
          `/api/locals/${localId}/`,
          {
            method: "PATCH",
            token: accessToken ?? undefined,
            body: payload,
          }
        );
        setLocals((prev) =>
          prev.map((local) => (local.id === updated.id ? updated : local))
        );
        if (payload.opening_hours) {
          setOpeningHours(normalizeOpeningHours(updated.opening_hours ?? {}));
        }
        if (feedbackTimeoutRef.current) {
          window.clearTimeout(feedbackTimeoutRef.current);
        }
        setFeedback("Cambios guardados");
        feedbackTimeoutRef.current = window.setTimeout(() => {
          setFeedback(null);
        }, 3000);
      } catch (err) {
        console.error(err);
        const message =
          err instanceof ApiError && err.details
            ? typeof err.details === "string"
              ? err.details
              : "No pudimos guardar los cambios."
            : "No pudimos guardar los cambios.";
        setError(message);
      } finally {
        setSavingSection(null);
      }
    },
    [accessToken]
  );

  const handleBasicSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!activeLocal) {
        return;
      }
      const payload: Partial<LocalProfile> = {
        name: basicForm.name.trim(),
        headline: basicForm.headline.trim(),
        description: basicForm.description.trim(),
        highlights: basicForm.highlights.trim(),
        address: basicForm.address.trim(),
        qr_code_url: basicForm.qr_code_url.trim() || null,
        amenities_note: basicForm.amenities_note.trim(),
        cover_image_url: basicForm.cover_image_url.trim() || null,
        gallery_urls: splitGallery(basicForm.gallery_text),
      };
      await updateLocal(activeLocal.id, payload, "basic");
    },
    [activeLocal, basicForm, updateLocal]
  );

  const handleContactSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!activeLocal) {
        return;
      }
      const payload: Partial<LocalProfile> = {
        contact_phone: contactForm.contact_phone.trim(),
        contact_email: contactForm.contact_email.trim(),
        whatsapp_number: contactForm.whatsapp_number.trim(),
        website_url: contactForm.website_url.trim(),
        reservation_url: contactForm.reservation_url.trim(),
        facebook_url: contactForm.facebook_url.trim(),
        instagram_url: contactForm.instagram_url.trim(),
        tiktok_url: contactForm.tiktok_url.trim(),
      };
      await updateLocal(activeLocal.id, payload, "contact");
    },
    [activeLocal, contactForm, updateLocal]
  );

  const handleLocationSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!activeLocal) {
        return;
      }
      const latitudeNumber = Number(locationForm.latitude.trim());
      const longitudeNumber = Number(locationForm.longitude.trim());
      const payload: Partial<LocalProfile> = {
        map_url: locationForm.map_url.trim(),
        map_embed_code: locationForm.map_embed_code.trim(),
        latitude: Number.isNaN(latitudeNumber) ? null : latitudeNumber,
        longitude: Number.isNaN(longitudeNumber) ? null : longitudeNumber,
      };
      await updateLocal(activeLocal.id, payload, "location");
    },
    [activeLocal, locationForm, updateLocal]
  );

  const handleWifiSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!activeLocal) {
        return;
      }
      const payload: Partial<LocalProfile> = {
        wifi_network: wifiForm.wifi_network.trim(),
        wifi_password: wifiForm.wifi_password.trim(),
      };
      await updateLocal(activeLocal.id, payload, "wifi");
    },
    [activeLocal, wifiForm, updateLocal]
  );

  const handleScheduleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!activeLocal) {
        return;
      }
      const payload: Partial<LocalProfile> = {
        opening_hours: openingHours,
        schedule: buildScheduleSummary(openingHours),
        timezone: timezoneValue.trim() || null,
      };
      await updateLocal(activeLocal.id, payload, "schedule");
    },
    [activeLocal, openingHours, timezoneValue, updateLocal]
  );

  const handleOpeningHourChange = useCallback(
    (day: WeekDay, field: keyof DayHours, value: string | boolean) => {
      setOpeningHours((prev) => ({
        ...prev,
        [day]: {
          ...prev[day],
          [field]: field === "closed" ? Boolean(value) : String(value),
        },
      }));
    },
    []
  );

  const handleToggleTag = useCallback(
    async (tagId: number) => {
      if (!activeLocal) {
        return;
      }
      const current = activeLocal.tags ?? [];
      const nextTags = current.includes(tagId)
        ? current.filter((id) => id !== tagId)
        : [...current, tagId];
      await updateLocal(activeLocal.id, { tags: nextTags }, "tags");
    },
    [activeLocal, updateLocal]
  );

  const handleCreateTag = useCallback(async () => {
    const name = newTagName.trim();
    if (!name || !accessToken) {
      return;
    }
    setTagSaving(true);
    setTagError(null);
    try {
      const created = await apiFetch<Tag>("/api/tags/", {
        method: "POST",
        token: accessToken ?? undefined,
        body: { name, scope: "local" },
      });
      setAvailableTags((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
      );
      if (activeLocal) {
        await updateLocal(
          activeLocal.id,
          { tags: [...(activeLocal.tags ?? []), created.id] },
          "tags"
        );
      }
      setNewTagName("");
    } catch (err) {
      const message =
        err instanceof ApiError && err.details
          ? typeof err.details === "string"
            ? err.details
            : "No pudimos crear la etiqueta."
          : "No pudimos crear la etiqueta.";
      setTagError(message);
    } finally {
      setTagSaving(false);
    }
  }, [newTagName, accessToken, activeLocal, updateLocal]);

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl rounded-3xl border border-white/15 bg-(--surface) p-10 text-center shadow-(--shadow-card)">
        <h1 className="text-2xl font-semibold text-(--foreground)">
          Inicia sesión para administrar tu local
        </h1>
        <p className="mt-2 text-(--muted-foreground)">
          Necesitas ingresar a Coffeefy para actualizar la información básica de
          tu cafetería.
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

  if (!activeLocal) {
    return (
      <div className="mx-auto max-w-3xl rounded-3xl border border-white/15 bg-(--surface) p-10 text-center shadow-(--shadow-card)">
        <h1 className="text-2xl font-semibold text-(--foreground)">
          Aún no tienes locales configurados
        </h1>
        <p className="mt-2 text-(--muted-foreground)">
          Crea tu primer local desde la app móvil o solicita asistencia para
          importar tus sucursales.
        </p>
      </div>
    );
  }

  const selectedTagIds = activeLocal.tags ?? [];

  return (
    <div className="flex flex-col gap-8">
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {feedback ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {feedback}
        </div>
      ) : null}

      <Reveal className="rounded-3xl border border-white/15 bg-(--surface) p-8 shadow-(--shadow-card)">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-(--foreground)">
              Perfil del local
            </h1>
            <p className="text-sm text-(--muted-foreground)">
              Mantén actualizada la información que se muestra en tu micrositio
              y en los canales digitales.
            </p>
          </div>
          {locals.length > 1 ? (
            <label className="text-sm font-semibold text-(--foreground)">
              Selecciona un local
              <select
                value={selectedLocalId ?? ""}
                onChange={(event) =>
                  setSelectedLocalId(Number(event.target.value) || null)
                }
                className="mt-1 w-full rounded-xl border border-white/30 bg-(--surface-alt) px-4 py-2 text-sm text-(--foreground) shadow-sm focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
              >
                {locals.map((local) => (
                  <option key={local.id} value={local.id}>
                    {local.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </Reveal>

      <Reveal className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <form
          onSubmit={handleBasicSubmit}
          className="grid gap-4 rounded-3xl border border-white/15 bg-(--surface) p-6 shadow-(--shadow-card)"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-(--foreground)">
                Información general
              </h2>
              <p className="text-xs text-(--muted-foreground)">
                Nombre, eslogan y descripción que verán tus clientes.
              </p>
            </div>
            <button
              type="submit"
              disabled={savingSection === "basic"}
              className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-(--muted-foreground) transition hover:border-(--accent) hover:text-(--accent) disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingSection === "basic" ? "Guardando…" : "Guardar"}
            </button>
          </div>

          <label className="text-sm font-semibold text-(--foreground)">
            Nombre comercial
            <input
              value={basicForm.name}
              onChange={(event) =>
                setBasicForm((prev) => ({ ...prev, name: event.target.value }))
              }
              className="mt-1 w-full rounded-xl border border-white/30 bg-(--surface-alt) px-4 py-2 text-sm text-(--foreground) shadow-sm focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
              required
            />
          </label>

          <label className="text-sm font-semibold text-(--foreground)">
            Titular o headline
            <input
              value={basicForm.headline}
              onChange={(event) =>
                setBasicForm((prev) => ({
                  ...prev,
                  headline: event.target.value,
                }))
              }
              placeholder="Café de especialidad con tostado propio"
              className="mt-1 w-full rounded-xl border border-white/30 bg-(--surface-alt) px-4 py-2 text-sm text-(--foreground) shadow-sm focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
            />
          </label>

          <label className="text-sm font-semibold text-(--foreground)">
            Descripción
            <textarea
              value={basicForm.description}
              onChange={(event) =>
                setBasicForm((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
              rows={4}
              className="mt-1 w-full rounded-xl border border-white/30 bg-(--surface-alt) px-4 py-2 text-sm text-(--foreground) shadow-sm focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
            />
          </label>

          <label className="text-sm font-semibold text-(--foreground)">
            Highlights
            <textarea
              value={basicForm.highlights}
              onChange={(event) =>
                setBasicForm((prev) => ({
                  ...prev,
                  highlights: event.target.value,
                }))
              }
              placeholder="Filtrados pour-over, brunch de temporada, catas semanales"
              rows={3}
              className="mt-1 w-full rounded-xl border border-white/30 bg-(--surface-alt) px-4 py-2 text-sm text-(--foreground) shadow-sm focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
            />
          </label>

          <label className="text-sm font-semibold text-(--foreground)">
            Dirección
            <input
              value={basicForm.address}
              onChange={(event) =>
                setBasicForm((prev) => ({
                  ...prev,
                  address: event.target.value,
                }))
              }
              className="mt-1 w-full rounded-xl border border-white/30 bg-(--surface-alt) px-4 py-2 text-sm text-(--foreground) shadow-sm focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-(--foreground)">
              QR del local
              <input
                value={basicForm.qr_code_url}
                onChange={(event) =>
                  setBasicForm((prev) => ({
                    ...prev,
                    qr_code_url: event.target.value,
                  }))
                }
                placeholder="URL del QR o imagen"
                className="mt-1 w-full rounded-xl border border-white/30 bg-(--surface-alt) px-4 py-2 text-sm text-(--foreground) shadow-sm focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
              />
            </label>
            <label className="text-sm font-semibold text-(--foreground)">
              Portada
              <input
                value={basicForm.cover_image_url}
                onChange={(event) =>
                  setBasicForm((prev) => ({
                    ...prev,
                    cover_image_url: event.target.value,
                  }))
                }
                placeholder="Imagen destacada (URL)"
                className="mt-1 w-full rounded-xl border border-white/30 bg-(--surface-alt) px-4 py-2 text-sm text-(--foreground) shadow-sm focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
              />
            </label>
          </div>

          <label className="text-sm font-semibold text-(--foreground)">
            Galería (una URL por línea)
            <textarea
              value={basicForm.gallery_text}
              onChange={(event) =>
                setBasicForm((prev) => ({
                  ...prev,
                  gallery_text: event.target.value,
                }))
              }
              rows={3}
              className="mt-1 w-full rounded-xl border border-white/30 bg-(--surface-alt) px-4 py-2 text-sm text-(--foreground) shadow-sm focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
            />
          </label>

          <label className="text-sm font-semibold text-(--foreground)">
            Nota sobre amenidades
            <textarea
              value={basicForm.amenities_note}
              onChange={(event) =>
                setBasicForm((prev) => ({
                  ...prev,
                  amenities_note: event.target.value,
                }))
              }
              placeholder="Pet friendly, enchufes disponibles, terraza techada…"
              rows={3}
              className="mt-1 w-full rounded-xl border border-white/30 bg-(--surface-alt) px-4 py-2 text-sm text-(--foreground) shadow-sm focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
            />
          </label>
        </form>

        <div className="flex flex-col gap-6">
          <form
            onSubmit={handleWifiSubmit}
            className="rounded-3xl border border-white/15 bg-(--surface) p-6 shadow-(--shadow-card)"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-(--foreground)">
                Wi-Fi para clientes
              </h2>
              <button
                type="submit"
                disabled={savingSection === "wifi"}
                className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-(--muted-foreground) transition hover:border-(--accent) hover:text-(--accent) disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingSection === "wifi" ? "Guardando…" : "Guardar"}
              </button>
            </div>
            <div className="grid gap-4">
              <label className="text-sm font-semibold text-(--foreground)">
                Nombre de red
                <input
                  value={wifiForm.wifi_network}
                  onChange={(event) =>
                    setWifiForm((prev) => ({
                      ...prev,
                      wifi_network: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-white/30 bg-(--surface-alt) px-4 py-2 text-sm text-(--foreground) shadow-sm focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
                />
              </label>
              <label className="text-sm font-semibold text-(--foreground)">
                Contraseña
                <input
                  value={wifiForm.wifi_password}
                  onChange={(event) =>
                    setWifiForm((prev) => ({
                      ...prev,
                      wifi_password: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-white/30 bg-(--surface-alt) px-4 py-2 text-sm text-(--foreground) shadow-sm focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
                />
              </label>
            </div>
          </form>

          <form
            onSubmit={handleContactSubmit}
            className="rounded-3xl border border-white/15 bg-(--surface) p-6 shadow-(--shadow-card)"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-(--foreground)">
                Contacto y canales
              </h2>
              <button
                type="submit"
                disabled={savingSection === "contact"}
                className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-(--muted-foreground) transition hover:border-(--accent) hover:text-(--accent) disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingSection === "contact" ? "Guardando…" : "Guardar"}
              </button>
            </div>
            <div className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold text-(--foreground)">
                  Teléfono
                  <input
                    value={contactForm.contact_phone}
                    onChange={(event) =>
                      setContactForm((prev) => ({
                        ...prev,
                        contact_phone: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-white/30 bg-(--surface-alt) px-4 py-2 text-sm text-(--foreground) shadow-sm focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
                  />
                </label>
                <label className="text-sm font-semibold text-(--foreground)">
                  Email de contacto
                  <input
                    value={contactForm.contact_email}
                    onChange={(event) =>
                      setContactForm((prev) => ({
                        ...prev,
                        contact_email: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-white/30 bg-(--surface-alt) px-4 py-2 text-sm text-(--foreground) shadow-sm focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold text-(--foreground)">
                  WhatsApp
                  <input
                    value={contactForm.whatsapp_number}
                    onChange={(event) =>
                      setContactForm((prev) => ({
                        ...prev,
                        whatsapp_number: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-white/30 bg-(--surface-alt) px-4 py-2 text-sm text-(--foreground) shadow-sm focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
                  />
                </label>
                <label className="text-sm font-semibold text-(--foreground)">
                  Sitio web
                  <input
                    value={contactForm.website_url}
                    onChange={(event) =>
                      setContactForm((prev) => ({
                        ...prev,
                        website_url: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-white/30 bg-(--surface-alt) px-4 py-2 text-sm text-(--foreground) shadow-sm focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
                  />
                </label>
              </div>

              <label className="text-sm font-semibold text-(--foreground)">
                Link de reservas
                <input
                  value={contactForm.reservation_url}
                  onChange={(event) =>
                    setContactForm((prev) => ({
                      ...prev,
                      reservation_url: event.target.value,
                    }))
                  }
                  placeholder="Agenda o formulario de reservas"
                  className="mt-1 w-full rounded-xl border border-white/30 bg-(--surface-alt) px-4 py-2 text-sm text-(--foreground) shadow-sm focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="text-sm font-semibold text-(--foreground)">
                  Instagram
                  <input
                    value={contactForm.instagram_url}
                    onChange={(event) =>
                      setContactForm((prev) => ({
                        ...prev,
                        instagram_url: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-white/30 bg-(--surface-alt) px-4 py-2 text-sm text-(--foreground) shadow-sm focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
                  />
                </label>
                <label className="text-sm font-semibold text-(--foreground)">
                  Facebook
                  <input
                    value={contactForm.facebook_url}
                    onChange={(event) =>
                      setContactForm((prev) => ({
                        ...prev,
                        facebook_url: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-white/30 bg-(--surface-alt) px-4 py-2 text-sm text-(--foreground) shadow-sm focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
                  />
                </label>
                <label className="text-sm font-semibold text-(--foreground)">
                  TikTok
                  <input
                    value={contactForm.tiktok_url}
                    onChange={(event) =>
                      setContactForm((prev) => ({
                        ...prev,
                        tiktok_url: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-white/30 bg-(--surface-alt) px-4 py-2 text-sm text-(--foreground) shadow-sm focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
                  />
                </label>
              </div>
            </div>
          </form>
        </div>
      </Reveal>

      <Reveal className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <form
          onSubmit={handleScheduleSubmit}
          className="rounded-3xl border border-white/15 bg-(--surface) p-6 shadow-(--shadow-card)"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-(--foreground)">
                Horarios de atención
              </h2>
              <p className="text-xs text-(--muted-foreground)">
                Define horarios por día y zona horaria para sincronizar tus
                canales.
              </p>
            </div>
            <button
              type="submit"
              disabled={savingSection === "schedule"}
              className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-(--muted-foreground) transition hover:border-(--accent) hover:text-(--accent) disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingSection === "schedule" ? "Guardando…" : "Guardar"}
            </button>
          </div>

          <label className="text-sm font-semibold text-(--foreground)">
            Zona horaria
            <input
              value={timezoneValue}
              onChange={(event) => setTimezoneValue(event.target.value)}
              placeholder="America/Santiago"
              className="mt-1 w-full rounded-xl border border-white/30 bg-(--surface-alt) px-4 py-2 text-sm text-(--foreground) shadow-sm focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
            />
          </label>

          <div className="mt-4 grid gap-3">
            {WEEK_DAYS.map((day) => {
              const info = openingHours[day];
              return (
                <div
                  key={day}
                  className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-(--surface-alt) p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-20 font-semibold text-(--foreground)">
                      {DAY_LABELS[day]}
                    </span>
                    <label className="flex items-center gap-2 text-xs font-semibold text-(--muted-foreground)">
                      <input
                        type="checkbox"
                        checked={info.closed}
                        onChange={(event) =>
                          handleOpeningHourChange(
                            day,
                            "closed",
                            event.target.checked
                          )
                        }
                        className="h-4 w-4 rounded border-white/40 bg-(--surface) text-(--accent) focus:ring-(--accent)"
                      />
                      Cerrado
                    </label>
                  </div>
                  {info.closed ? (
                    <span className="text-xs text-(--muted-foreground)">
                      Sin atención este día
                    </span>
                  ) : (
                    <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
                      <label className="flex items-center gap-2 text-xs font-semibold text-(--muted-foreground)">
                        <span>Apertura</span>
                        <input
                          type="time"
                          value={info.open}
                          onChange={(event) =>
                            handleOpeningHourChange(
                              day,
                              "open",
                              event.target.value
                            )
                          }
                          className="rounded border border-white/20 bg-(--surface) px-3 py-1 text-sm text-(--foreground) shadow-sm focus:border-(--accent) focus:outline-none"
                        />
                      </label>
                      <label className="flex items-center gap-2 text-xs font-semibold text-(--muted-foreground)">
                        <span>Cierre</span>
                        <input
                          type="time"
                          value={info.close}
                          onChange={(event) =>
                            handleOpeningHourChange(
                              day,
                              "close",
                              event.target.value
                            )
                          }
                          className="rounded border border-white/20 bg-(--surface) px-3 py-1 text-sm text-(--foreground) shadow-sm focus:border-(--accent) focus:outline-none"
                        />
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </form>

        <form
          onSubmit={handleLocationSubmit}
          className="rounded-3xl border border-white/15 bg-(--surface) p-6 shadow-(--shadow-card)"
        >
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-(--foreground)">
                Ubicación y mapa
              </h2>
              <p className="text-xs text-(--muted-foreground)">
                Conecta Google Maps o ubica tu cafetería en el mapa.
              </p>
            </div>
            <button
              type="submit"
              disabled={savingSection === "location"}
              className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-(--muted-foreground) transition hover:border-(--accent) hover:text-(--accent) disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingSection === "location" ? "Guardando…" : "Guardar"}
            </button>
          </div>

          <label className="text-sm font-semibold text-(--foreground)">
            Enlace a Maps
            <input
              value={locationForm.map_url}
              onChange={(event) =>
                setLocationForm((prev) => ({
                  ...prev,
                  map_url: event.target.value,
                }))
              }
              placeholder="https://maps.google.com/..."
              className="mt-1 w-full rounded-xl border border-white/30 bg-(--surface-alt) px-4 py-2 text-sm text-(--foreground) shadow-sm focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
            />
          </label>

          <label className="text-sm font-semibold text-(--foreground)">
            Código embebido (iframe)
            <textarea
              value={locationForm.map_embed_code}
              onChange={(event) =>
                setLocationForm((prev) => ({
                  ...prev,
                  map_embed_code: event.target.value,
                }))
              }
              rows={3}
              className="mt-1 w-full rounded-xl border border-white/30 bg-(--surface-alt) px-4 py-2 text-sm text-(--foreground) shadow-sm focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-(--foreground)">
              Latitud
              <input
                value={locationForm.latitude}
                onChange={(event) =>
                  setLocationForm((prev) => ({
                    ...prev,
                    latitude: event.target.value,
                  }))
                }
                placeholder="-33.456"
                className="mt-1 w-full rounded-xl border border-white/30 bg-(--surface-alt) px-4 py-2 text-sm text-(--foreground) shadow-sm focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
              />
            </label>
            <label className="text-sm font-semibold text-(--foreground)">
              Longitud
              <input
                value={locationForm.longitude}
                onChange={(event) =>
                  setLocationForm((prev) => ({
                    ...prev,
                    longitude: event.target.value,
                  }))
                }
                placeholder="-70.648"
                className="mt-1 w-full rounded-xl border border-white/30 bg-(--surface-alt) px-4 py-2 text-sm text-(--foreground) shadow-sm focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
              />
            </label>
          </div>
        </form>
      </Reveal>

      <Reveal className="rounded-3xl border border-white/15 bg-(--surface) p-6 shadow-(--shadow-card)">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-(--foreground)">
              Etiquetas del local
            </h2>
            <p className="text-xs text-(--muted-foreground)">
              Destaca amenities y focos gastronómicos para tus visitantes.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <input
                value={newTagName}
                onChange={(event) => {
                  setNewTagName(event.target.value);
                  if (tagError) {
                    setTagError(null);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleCreateTag();
                  }
                }}
                placeholder="Nueva etiqueta"
                className="w-full rounded-xl border border-white/30 bg-(--surface-alt) px-4 py-2 text-sm text-(--foreground) shadow-sm focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
              />
              <button
                type="button"
                onClick={handleCreateTag}
                disabled={tagSaving || !newTagName.trim()}
                className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-(--muted-foreground) transition hover:border-(--accent) hover:text-(--accent) disabled:cursor-not-allowed disabled:opacity-60"
              >
                {tagSaving ? "Creando…" : "Crear"}
              </button>
            </div>
            {tagError ? (
              <span className="text-xs text-red-500">{tagError}</span>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {availableTags.length === 0 ? (
            <span className="text-sm text-(--muted-foreground)">
              Aún no tienes etiquetas creadas.
            </span>
          ) : (
            availableTags.map((tag) => {
              const isActive = selectedTagIds.includes(tag.id);
              const isGeneral = tag.scope === "general";
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => handleToggleTag(tag.id)}
                  disabled={savingSection === "tags"}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    isActive
                      ? "border-(--accent) bg-(--accent) text-white"
                      : "border-white/20 text-(--muted-foreground) hover:border-(--accent) hover:text-(--accent)"
                  } ${
                    savingSection === "tags"
                      ? "cursor-not-allowed opacity-60"
                      : ""
                  }`}
                  title={tag.description ?? undefined}
                >
                  {tag.name}
                  {isGeneral ? " · Global" : ""}
                </button>
              );
            })
          )}
        </div>
      </Reveal>
    </div>
  );
}
