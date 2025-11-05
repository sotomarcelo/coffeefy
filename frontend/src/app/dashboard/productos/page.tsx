"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { useAuth } from "@/hooks/use-auth";
import { Reveal } from "@/components/reveal";
import { apiFetch, ApiError } from "@/lib/api";

type Tag = {
  id: number;
  name: string;
  slug: string;
  scope: "general" | "product" | "local";
  description?: string;
  icon?: string;
  accent_color?: string;
};

type Local = {
  id: number;
  name: string;
  owner: number;
  owner_name: string;
  type: string;
  headline?: string;
  highlights?: string;
  description?: string;
  address?: string;
  schedule?: string;
  opening_hours?: Record<string, unknown> | null;
  contact_phone?: string;
  contact_email?: string;
  whatsapp_number?: string;
  website_url?: string;
  reservation_url?: string;
  facebook_url?: string;
  instagram_url?: string;
  tiktok_url?: string;
  map_url?: string;
  map_embed_code?: string;
  latitude?: number | null;
  longitude?: number | null;
  tags?: number[];
  tag_details?: Tag[];
};

type ProductCategory = {
  id: number;
  name: string;
  slug: string;
  description: string;
  local: number;
  local_name: string;
  tracks_stock: boolean;
  created_at: string;
  updated_at: string;
};

type StockState = "available" | "normal" | "low" | "critical" | "out";

type Product = {
  id: number;
  local: number;
  local_name: string;
  category: number;
  category_name: string;
  category_slug: string;
  category_tracks_stock: boolean;
  tracks_stock: boolean;
  name: string;
  description: string;
  price: string;
  stock: number;
  in_stock: boolean;
  stock_state: StockState;
  low_stock_threshold: number;
  critical_stock_threshold: number;
  display_order: number;
  state: string;
  is_active: boolean;
  image_url: string | null;
  tags?: number[];
  tag_details?: Tag[];
  created_at: string;
  updated_at: string;
};

const PRODUCT_STATES = {
  normal: "Normal",
  recien_tostado: "Recién tostado",
  promocion: "En promoción",
} as const;

const STOCK_STATE_LABELS: Record<StockState, string> = {
  available: "Disponible",
  normal: "Stock saludable",
  low: "Stock bajo",
  critical: "Stock crítico",
  out: "Sin stock",
};

const STOCK_BADGE_CLASSES: Record<StockState, string> = {
  available: "bg-(--surface-alt) text-(--muted-foreground)",
  normal: "bg-(--surface-alt) text-(--muted-foreground)",
  low: "bg-yellow-100 text-yellow-800",
  critical: "bg-red-100 text-red-700",
  out: "bg-red-200 text-red-800",
};

const columnHelper = createColumnHelper<Product>();

type ProductFormState = {
  name: string;
  description: string;
  price: string;
  localId: string;
  categoryId: string;
  stock: string;
  inStock: boolean;
  tracksStock: boolean;
  lowStockThreshold: string;
  criticalStockThreshold: string;
  state: keyof typeof PRODUCT_STATES;
  image_url: string;
  tagIds: number[];
};

type CategoryFormState = {
  name: string;
  tracks_stock: boolean;
};

const EMPTY_FORM: ProductFormState = {
  name: "",
  description: "",
  price: "",
  localId: "",
  categoryId: "",
  stock: "",
  inStock: true,
  tracksStock: true,
  lowStockThreshold: "5",
  criticalStockThreshold: "0",
  state: "normal",
  image_url: "",
  tagIds: [],
};

const EMPTY_CATEGORY_FORM: CategoryFormState = {
  name: "",
  tracks_stock: false,
};

export default function CatalogPage() {
  const { user, accessToken } = useAuth();
  const [locals, setLocals] = useState<Local[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ProductFormState>({ ...EMPTY_FORM });
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingProductId, setUpdatingProductId] = useState<number | null>(
    null
  );
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState<CategoryFormState>({
    ...EMPTY_CATEGORY_FORM,
  });
  const [categorySaving, setCategorySaving] = useState(false);
  const [editingCategory, setEditingCategory] =
    useState<ProductCategory | null>(null);
  const [stockFilter, setStockFilter] = useState<"all" | "critical">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | number>("all");
  const productTableRef = useRef<HTMLDivElement | null>(null);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [tagSaving, setTagSaving] = useState(false);
  const [tagError, setTagError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !accessToken) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [
          localsResponse,
          productsResponse,
          categoriesResponse,
          tagsResponse,
        ] = await Promise.all([
          apiFetch<Local[]>("/api/locals/", {
            token: accessToken ?? undefined,
          }),
          apiFetch<Product[]>("/api/products/", {
            token: accessToken ?? undefined,
          }),
          apiFetch<ProductCategory[]>("/api/categories/", {
            token: accessToken ?? undefined,
          }),
          apiFetch<Tag[]>("/api/tags/?scope=product", {
            token: accessToken ?? undefined,
          }),
        ]);
        setLocals(localsResponse);
        setProducts(productsResponse);
        setCategories(categoriesResponse);
        setAvailableTags(
          [...tagsResponse].sort((a, b) => a.name.localeCompare(b.name))
        );
      } catch (err) {
        console.error(err);
        setError(
          "No pudimos cargar el catálogo. Intenta nuevamente en unos minutos."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, accessToken]);

  const myLocals = useMemo(() => {
    if (!user) return [] as Local[];
    return locals.filter((local) => local.owner_name === user.username);
  }, [locals, user]);

  const myLocalIds = useMemo(
    () => new Set(myLocals.map((local) => local.id)),
    [myLocals]
  );
  const primaryLocal = myLocals[0] ?? null;

  const resetCategoryForm = useCallback(() => {
    setEditingCategory(null);
    setNewCategory({ ...EMPTY_CATEGORY_FORM });
  }, []);

  const visibleProducts = useMemo(() => {
    if (myLocalIds.size === 0) return [] as Product[];
    return products
      .filter((product) => myLocalIds.has(product.local))
      .sort((a, b) => {
        if (a.category === b.category) {
          return (
            a.display_order - b.display_order || a.name.localeCompare(b.name)
          );
        }
        return a.category_name.localeCompare(b.category_name);
      });
  }, [products, myLocalIds]);

  useEffect(() => {
    if (myLocals.length === 0) return;
    setForm((prev) => {
      if (prev.localId) return prev;
      return { ...prev, localId: String(myLocals[0].id) };
    });
  }, [myLocals]);

  const manageableCategories = useMemo(() => {
    if (myLocalIds.size === 0) return [] as ProductCategory[];
    return categories.filter((category) => myLocalIds.has(category.local));
  }, [categories, myLocalIds]);

  const totalActive = visibleProducts.filter(
    (product) => product.is_active
  ).length;

  const criticalProducts = useMemo(
    () =>
      visibleProducts.filter(
        (product) => product.tracks_stock && product.stock_state === "critical"
      ),
    [visibleProducts]
  );

  const filteredProducts = useMemo(() => {
    let dataset = visibleProducts;

    if (stockFilter === "critical") {
      dataset = criticalProducts;
    }

    if (categoryFilter !== "all") {
      dataset = dataset.filter(
        (product) => product.category === categoryFilter
      );
    }

    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      dataset = dataset.filter(
        (product) =>
          product.name.toLowerCase().includes(term) ||
          (product.description ?? "").toLowerCase().includes(term)
      );
    }

    return dataset;
  }, [
    visibleProducts,
    criticalProducts,
    stockFilter,
    categoryFilter,
    searchTerm,
  ]);

  const categoryFilterValue =
    categoryFilter === "all" ? "all" : String(categoryFilter);
  const isFiltering =
    stockFilter === "critical" ||
    categoryFilter !== "all" ||
    searchTerm.trim().length > 0;

  useEffect(() => {
    if (stockFilter === "critical" && productTableRef.current) {
      productTableRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [stockFilter]);

  useEffect(() => {
    if (!form.tracksStock) return;
    const numericStock = Number(form.stock || 0);
    const nextInStock = numericStock > 0;
    if (form.inStock !== nextInStock) {
      setForm((prev) => ({ ...prev, inStock: nextInStock }));
    }
  }, [form.tracksStock, form.stock, form.inStock]);

  const handleRefreshProducts = useCallback(async () => {
    if (!user || !accessToken) return;
    try {
      const [productsResponse, tagsResponse] = await Promise.all([
        apiFetch<Product[]>("/api/products/", {
          token: accessToken ?? undefined,
        }),
        apiFetch<Tag[]>("/api/tags/?scope=product", {
          token: accessToken ?? undefined,
        }),
      ]);
      setProducts(productsResponse);
      setAvailableTags(
        [...tagsResponse].sort((a, b) => a.name.localeCompare(b.name))
      );
    } catch (err) {
      console.error(err);
      setError("No pudimos actualizar la lista de productos.");
    }
  }, [user, accessToken]);

  const handleRefreshCategories = useCallback(async () => {
    if (!user || !accessToken) return;
    try {
      const data = await apiFetch<ProductCategory[]>("/api/categories/", {
        token: accessToken ?? undefined,
      });
      setCategories(data);
    } catch (err) {
      console.error(err);
      setError("No pudimos actualizar las categorías.");
    }
  }, [user, accessToken]);

  const handleFormChange = <K extends keyof ProductFormState>(
    field: K,
    value: ProductFormState[K]
  ) => {
    setForm((prev) => {
      const next: ProductFormState = { ...prev, [field]: value };

      if (field === "categoryId") {
        const category = categories.find(
          (item) => String(item.id) === String(value)
        );

        if (category) {
          next.tracksStock = category.tracks_stock;
          if (category.local) {
            next.localId = String(category.local);
          }

          if (!category.tracks_stock) {
            next.stock = "";
            next.lowStockThreshold = "0";
            next.criticalStockThreshold = "0";
          } else if (!editingProduct) {
            next.lowStockThreshold = prev.lowStockThreshold || "5";
            next.criticalStockThreshold = prev.criticalStockThreshold || "0";
          }
        }
      }

      if (field === "tracksStock" && value === false) {
        next.stock = "";
        next.lowStockThreshold = "0";
        next.criticalStockThreshold = "0";
        next.inStock = true;
      }

      if (field === "tracksStock" && value === true && !editingProduct) {
        next.lowStockThreshold = next.lowStockThreshold || "5";
        next.criticalStockThreshold = next.criticalStockThreshold || "0";
      }

      return next;
    });
  };

  const handleCategoryFormChange = <T extends keyof CategoryFormState>(
    field: T,
    value: CategoryFormState[T]
  ) => {
    setNewCategory((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmitCategory = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!accessToken) {
      setError("Tu sesión expiró. Inicia sesión nuevamente.");
      return;
    }

    if (!newCategory.name.trim()) {
      setError("Ingresa un nombre para la categoría.");
      return;
    }

    const primaryLocal = myLocals[0];
    if (!primaryLocal) {
      setError("Necesitas registrar un local antes de crear categorías.");
      return;
    }

    const payload: Record<string, unknown> = {
      name: newCategory.name.trim(),
      tracks_stock: newCategory.tracks_stock,
      local: editingCategory ? editingCategory.local : primaryLocal.id,
    };

    setCategorySaving(true);
    setError(null);

    try {
      let category: ProductCategory;

      if (editingCategory) {
        category = await apiFetch<ProductCategory>(
          `/api/categories/${editingCategory.id}/`,
          {
            method: "PATCH",
            token: accessToken ?? undefined,
            body: payload,
          }
        );
        setCategories((prev) =>
          prev.map((item) => (item.id === category.id ? category : item))
        );
        if (form.categoryId === String(category.id)) {
          setForm((prev) => ({
            ...prev,
            categoryId: String(category.id),
          }));
        }
      } else {
        category = await apiFetch<ProductCategory>("/api/categories/", {
          method: "POST",
          token: accessToken ?? undefined,
          body: payload,
        });
        setCategories((prev) => [...prev, category]);
        setForm((prev) => ({
          ...prev,
          categoryId: String(category.id),
        }));
      }

      setCreatingCategory(false);
      resetCategoryForm();
    } catch (err) {
      console.error(err);
      if (err instanceof ApiError) {
        setError(
          typeof err.details === "string"
            ? err.details
            : "No pudimos guardar la categoría. Revisa los datos."
        );
      } else {
        setError("Ocurrió un error inesperado al guardar la categoría.");
      }
    } finally {
      setCategorySaving(false);
    }
  };

  const handleEditCategory = (category: ProductCategory) => {
    setError(null);
    setEditingCategory(category);
    setCreatingCategory(true);
    setNewCategory({
      name: category.name,
      tracks_stock: category.tracks_stock,
    });
  };

  const handleSubmitProduct = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!accessToken) {
      setError("Tu sesión expiró. Inicia sesión nuevamente.");
      return;
    }

    if (!form.localId) {
      setError("Selecciona un local para asociar el producto.");
      return;
    }

    if (!form.categoryId) {
      setError("Selecciona una categoría para el producto.");
      return;
    }

    if (!form.name.trim() || !form.price) {
      setError("Completa al menos nombre y precio para guardar el producto.");
      return;
    }

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      description: form.description.trim(),
      price: form.price,
      category: Number(form.categoryId),
      state: form.state,
      local: Number(form.localId),
      image_url: form.image_url?.trim() || null,
      tracks_stock: form.tracksStock,
      tags: form.tagIds,
    };

    if (!editingProduct) {
      payload.is_active = true;
    }

    if (form.tracksStock) {
      const parsedStock = Number(form.stock ?? "");
      const parsedLow = Number(form.lowStockThreshold ?? "");
      const parsedCritical = Number(form.criticalStockThreshold ?? "");

      if (Number.isNaN(parsedStock)) {
        setError("Stock debe ser un número válido.");
        return;
      }
      if (Number.isNaN(parsedLow) || Number.isNaN(parsedCritical)) {
        setError("Los umbrales deben ser números válidos.");
        return;
      }

      const normalizedStock = Math.max(parsedStock, 0);
      const normalizedCritical = Math.max(parsedCritical, 0);
      const normalizedLow = Math.max(parsedLow, 0);

      if (normalizedLow < normalizedCritical) {
        setError(
          "El umbral de stock bajo debe ser igual o superior al crítico."
        );
        return;
      }

      payload.stock = normalizedStock;
      payload.low_stock_threshold = normalizedLow;
      payload.critical_stock_threshold = normalizedCritical;
      payload.in_stock = normalizedStock > 0;
    } else {
      payload.stock = 0;
      payload.low_stock_threshold = 0;
      payload.critical_stock_threshold = 0;
      payload.in_stock = form.inStock;
    }

    setSaving(true);
    setError(null);

    try {
      if (editingProduct) {
        await apiFetch<Product>(`/api/products/${editingProduct.id}/`, {
          method: "PATCH",
          token: accessToken ?? undefined,
          body: payload,
        });
      } else {
        await apiFetch<Product>("/api/products/", {
          method: "POST",
          token: accessToken ?? undefined,
          body: payload,
        });
      }
      setForm({ ...EMPTY_FORM });
      setEditingProduct(null);
      setShowForm(false);
      await handleRefreshProducts();
    } catch (err) {
      console.error(err);
      if (err instanceof ApiError) {
        setError(
          typeof err.details === "string"
            ? err.details
            : "No pudimos guardar el producto. Revisa los datos ingresados."
        );
      } else {
        setError("Ocurrió un error inesperado al guardar el producto.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleEditProduct = useCallback((product: Product) => {
    setError(null);
    setEditingProduct(product);
    setShowForm(true);
    setForm({
      ...EMPTY_FORM,
      name: product.name,
      description: product.description ?? "",
      price: product.price,
      localId: String(product.local),
      categoryId: String(product.category),
      stock: product.tracks_stock ? String(product.stock) : "",
      inStock: product.in_stock,
      tracksStock: product.tracks_stock,
      lowStockThreshold: String(product.low_stock_threshold ?? 0),
      criticalStockThreshold: String(product.critical_stock_threshold ?? 0),
      state: product.state as ProductFormState["state"],
      image_url: product.image_url ?? "",
      tagIds:
        Array.isArray(product.tags) && product.tags.length > 0
          ? product.tags
          : product.tag_details?.map((tag) => tag.id) ?? [],
    });
  }, []);

  const handleToggleActive = useCallback(
    async (product: Product) => {
      if (!accessToken) return;
      setUpdatingProductId(product.id);
      setError(null);
      try {
        await apiFetch<Product>(`/api/products/${product.id}/`, {
          method: "PATCH",
          token: accessToken ?? undefined,
          body: { is_active: !product.is_active },
        });
        await handleRefreshProducts();
      } catch (err) {
        console.error(err);
        setError("No pudimos actualizar el estado del producto.");
      } finally {
        setUpdatingProductId(null);
      }
    },
    [accessToken, handleRefreshProducts]
  );

  const handleStockAdjust = useCallback(
    async (product: Product, delta: number) => {
      if (!product.tracks_stock) return;
      if (!accessToken) return;
      const current = product.stock;
      const next = current + delta;
      if (next < 0) return;

      setUpdatingProductId(product.id);
      setError(null);
      try {
        await apiFetch<Product>(`/api/products/${product.id}/`, {
          method: "PATCH",
          token: accessToken ?? undefined,
          body: { stock: next },
        });
        await handleRefreshProducts();
      } catch (err) {
        console.error(err);
        setError("No pudimos ajustar el stock. Intenta nuevamente.");
      } finally {
        setUpdatingProductId(null);
      }
    },
    [accessToken, handleRefreshProducts]
  );

  const handleToggleAvailability = useCallback(
    async (product: Product) => {
      if (product.tracks_stock) return;
      if (!accessToken) return;
      setUpdatingProductId(product.id);
      setError(null);
      try {
        await apiFetch<Product>(`/api/products/${product.id}/`, {
          method: "PATCH",
          token: accessToken ?? undefined,
          body: { in_stock: !product.in_stock },
        });
        await handleRefreshProducts();
      } catch (err) {
        console.error(err);
        setError("No pudimos actualizar la disponibilidad del producto.");
      } finally {
        setUpdatingProductId(null);
      }
    },
    [accessToken, handleRefreshProducts]
  );

  const handleToggleTag = useCallback((tagId: number) => {
    setForm((prev) => {
      const exists = prev.tagIds.includes(tagId);
      const nextTagIds = exists
        ? prev.tagIds.filter((id) => id !== tagId)
        : [...prev.tagIds, tagId];
      return { ...prev, tagIds: nextTagIds };
    });
  }, []);

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
        body: { name, scope: "product" },
      });
      setAvailableTags((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
      );
      setForm((prev) =>
        prev.tagIds.includes(created.id)
          ? prev
          : { ...prev, tagIds: [...prev.tagIds, created.id] }
      );
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
  }, [newTagName, accessToken]);

  const columns = useMemo<ColumnDef<Product>[]>(
    () => [
      columnHelper.display({
        id: "product",
        header: () => "Producto",
        enableResizing: true,
        size: 260,
        minSize: 200,
        cell: ({ row }) => {
          const product = row.original;
          const resolvedTags = product.tag_details?.length
            ? product.tag_details
            : Array.isArray(product.tags)
            ? product.tags
                .map((id) => availableTags.find((tag) => tag.id === id) ?? null)
                .filter((tag): tag is Tag => Boolean(tag))
            : [];
          return (
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-(--foreground)">
                {product.name}
              </span>
              <span className="text-xs text-(--muted-foreground)">
                {product.description || "Sin descripción"}
              </span>
              {resolvedTags.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {resolvedTags.map((tag) => (
                    <span
                      key={tag.id}
                      className="rounded-full bg-(--surface-alt) px-2 py-0.5 text-[11px] font-semibold text-(--muted-foreground)"
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          );
        },
      }),
      columnHelper.display({
        id: "category",
        header: () => "Categoría",
        enableResizing: true,
        size: 160,
        minSize: 140,
        cell: ({ row }) => (
          <span className="text-sm text-(--muted-foreground)">
            {row.original.category_name}
          </span>
        ),
      }),
      columnHelper.display({
        id: "price",
        header: () => "Precio",
        enableResizing: true,
        size: 120,
        minSize: 110,
        cell: ({ row }) => {
          const price = Number(row.original.price);
          return (
            <span className="text-sm text-(--muted-foreground)">
              {`$${price.toFixed(2)}`}
            </span>
          );
        },
      }),
      columnHelper.display({
        id: "state",
        header: () => "Estado",
        enableResizing: true,
        size: 140,
        minSize: 120,
        cell: ({ row }) => (
          <span className="rounded-full bg-(--surface-alt) px-3 py-1 text-xs font-medium text-(--muted-foreground)">
            {PRODUCT_STATES[
              row.original.state as keyof typeof PRODUCT_STATES
            ] ?? row.original.state}
          </span>
        ),
      }),
      columnHelper.display({
        id: "stock",
        header: () => "Stock",
        enableResizing: true,
        size: 220,
        minSize: 200,
        cell: ({ row }) => {
          const product = row.original;
          const isUpdating = updatingProductId === product.id;
          const tracksStock = product.tracks_stock;
          const stockStateClass = STOCK_BADGE_CLASSES[product.stock_state];
          const stockStateLabel = STOCK_STATE_LABELS[product.stock_state];

          return tracksStock ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isUpdating || product.stock === 0}
                  onClick={() => handleStockAdjust(product, -1)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/20 text-xs font-bold text-(--muted-foreground) transition hover:border-(--accent) hover:text-(--accent) disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Restar stock"
                >
                  −
                </button>
                <span
                  className={`rounded-full px-3 py-1 text-sm font-semibold ${stockStateClass}`}
                >
                  {product.stock}
                </span>
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => handleStockAdjust(product, 1)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/20 text-xs font-bold text-(--muted-foreground) transition hover:border-(--accent) hover:text-(--accent) disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Sumar stock"
                >
                  +
                </button>
              </div>
              <p className="text-xs text-(--muted-foreground)">
                Estado: {stockStateLabel}
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  product.in_stock
                    ? "bg-(--surface-alt) text-(--muted-foreground)"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {product.in_stock ? "Disponible" : "Sin stock"}
              </span>
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => handleToggleAvailability(product)}
                className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-(--muted-foreground) transition hover:border-(--accent) hover:text-(--accent) disabled:cursor-not-allowed disabled:opacity-50"
              >
                {product.in_stock ? "Marcar sin stock" : "Marcar con stock"}
              </button>
            </div>
          );
        },
      }),
      columnHelper.display({
        id: "actions",
        header: () => "Acciones",
        enableResizing: true,
        size: 180,
        minSize: 160,
        cell: ({ row }) => {
          const product = row.original;
          const isUpdating = updatingProductId === product.id;
          return (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleEditProduct(product)}
                className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-(--muted-foreground) transition hover:border-(--accent) hover:text-(--accent)"
              >
                Editar
              </button>
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => handleToggleActive(product)}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                  product.is_active
                    ? "border border-white/20 text-(--muted-foreground) hover:border-(--accent) hover:text-(--accent)"
                    : "bg-(--accent) text-white hover:bg-(--accent-dark)"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {product.is_active ? "Pausar" : "Reactivar"}
              </button>
            </div>
          );
        },
      }),
    ],
    [
      handleEditProduct,
      handleToggleActive,
      handleStockAdjust,
      handleToggleAvailability,
      updatingProductId,
      availableTags,
    ]
  );

  const table = useReactTable({
    data: filteredProducts,
    columns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: "onChange",
  });

  const tableRows = table.getRowModel().rows;
  const leafColumnCount = Math.max(table.getAllLeafColumns().length, 1);

  if (!user) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4 rounded-3xl border border-white/15 bg-(--surface) p-10 text-center shadow-(--shadow-card)">
        <h1 className="text-2xl font-semibold">
          Inicia sesión para gestionar tu catálogo
        </h1>
        <p className="text-(--muted-foreground)">
          Necesitas ingresar a Coffeefy para administrar tus productos y su
          stock.
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

  if (myLocals.length === 0) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6 rounded-3xl border border-white/15 bg-(--surface) p-10 text-center shadow-(--shadow-card)">
        <h1 className="text-2xl font-semibold text-(--foreground)">
          Primero crea un local
        </h1>
        <p className="text-(--muted-foreground)">
          Aún no encontramos locales asociados a tu cuenta. Registra uno desde
          el panel de locales para comenzar a cargar tu catálogo.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <Reveal className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-white/15 bg-(--surface) p-6 shadow-(--shadow-card)">
          <p className="text-xs uppercase tracking-wide text-(--muted-foreground)">
            Productos activos
          </p>
          <p className="mt-2 text-3xl font-semibold text-(--foreground)">
            {totalActive}
          </p>
          <p className="text-xs text-(--muted-foreground)">
            {visibleProducts.length} en total
          </p>
        </div>
        <div className="rounded-3xl border border-white/15 bg-(--surface) p-6 shadow-(--shadow-card)">
          <p className="text-xs uppercase tracking-wide text-(--muted-foreground)">
            Tu local
          </p>
          <p className="mt-2 text-2xl font-semibold text-(--foreground)">
            {primaryLocal?.name ?? "Sin nombre"}
          </p>
          <p className="text-xs text-(--muted-foreground)">
            {primaryLocal?.type
              ? `Tipo: ${primaryLocal.type}`
              : "Gestionas un único local"}
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            setStockFilter((prev) => (prev === "critical" ? "all" : "critical"))
          }
          className={`text-left rounded-3xl border p-6 shadow-(--shadow-card) transition ${
            stockFilter === "critical"
              ? "border-(--accent) bg-(--surface-alt)"
              : "border-white/15 bg-(--surface) hover:border-(--accent)"
          }`}
        >
          <p className="text-xs uppercase tracking-wide text-(--muted)">
            Stock crítico
          </p>
          <p className="mt-2 text-3xl font-semibold text-(--accent)">
            {criticalProducts.length}
          </p>
          <p className="text-xs text-(--muted-foreground)">
            {stockFilter === "critical"
              ? "Mostrando solo productos críticos"
              : "Haz clic para filtrar los productos críticos"}
          </p>
        </button>
      </Reveal>

      <Reveal className="rounded-3xl border border-white/15 bg-(--surface) p-8 shadow-(--shadow-card)">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-(--foreground)">
              Catálogo
            </h2>
            <p className="text-sm text-(--muted-foreground)">
              Administra tu oferta completa y elige qué categorías llevan
              seguimiento de stock.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setShowForm((prev) => !prev);
                setEditingProduct(null);
                setForm({ ...EMPTY_FORM });
              }}
              className="rounded-full bg-(--accent) px-5 py-2 text-sm font-semibold text-white transition hover:bg-(--accent-dark)"
            >
              {editingProduct
                ? "Cancelar edición"
                : showForm
                ? "Cerrar formulario"
                : "Nuevo producto"}
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                if (creatingCategory) {
                  setCreatingCategory(false);
                  resetCategoryForm();
                } else {
                  resetCategoryForm();
                  setCreatingCategory(true);
                }
              }}
              className="rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-(--muted-foreground) transition hover:border-(--accent) hover:text-(--accent)"
            >
              {editingCategory
                ? "Cancelar edición"
                : creatingCategory
                ? "Cerrar formulario"
                : "Nueva categoría"}
            </button>
          </div>
        </div>

        {creatingCategory ? (
          <form
            onSubmit={handleSubmitCategory}
            className="mt-6 grid gap-4 rounded-2xl border border-white/10 bg-(--surface-alt) p-6"
          >
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-lg font-semibold text-(--foreground)">
                {editingCategory ? "Editar categoría" : "Nueva categoría"}
              </h3>
              {editingCategory ? (
                <span className="text-xs text-(--muted-foreground)">
                  {editingCategory.local_name ||
                    myLocals[0]?.name ||
                    "Sin local"}
                </span>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
              <label className="text-sm font-semibold text-(--foreground)">
                Nombre de la categoría
                <input
                  value={newCategory.name}
                  onChange={(event) =>
                    handleCategoryFormChange("name", event.target.value)
                  }
                  placeholder="Pastelería, Merch, etc."
                  className="mt-1 w-full rounded-xl border border-white/40 bg-(--surface) px-4 py-3 text-sm text-(--foreground) shadow-sm focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
                  required
                />
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-(--foreground)">
                <input
                  type="checkbox"
                  checked={newCategory.tracks_stock}
                  onChange={(event) =>
                    handleCategoryFormChange(
                      "tracks_stock",
                      event.target.checked
                    )
                  }
                  className="h-4 w-4 rounded border-white/40 bg-(--surface) text-(--accent) focus:ring-(--accent)"
                />
                Seguir stock para esta categoría
              </label>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setCreatingCategory(false);
                  resetCategoryForm();
                }}
                className="rounded-full border border-white/30 px-5 py-2 text-sm font-semibold text-(--muted-foreground) transition hover:border-(--accent) hover:text-(--accent)"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={categorySaving}
                className="rounded-full bg-(--accent) px-6 py-2 text-sm font-semibold text-white transition hover:bg-(--accent-dark) disabled:cursor-not-allowed disabled:opacity-70"
              >
                {categorySaving
                  ? "Guardando…"
                  : editingCategory
                  ? "Guardar cambios"
                  : "Crear categoría"}
              </button>
            </div>
          </form>
        ) : null}

        {showForm ? (
          <form
            onSubmit={handleSubmitProduct}
            className="mt-6 grid gap-4 rounded-2xl border border-white/10 bg-(--surface-alt) p-6"
          >
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-lg font-semibold text-(--foreground)">
                {editingProduct ? "Editar producto" : "Nuevo producto"}
              </h3>
              {editingProduct ? (
                <span className="text-xs text-(--muted-foreground)">
                  ID #{editingProduct.id}
                </span>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-(--foreground)">
                Nombre
                <input
                  value={form.name}
                  onChange={(event) =>
                    handleFormChange("name", event.target.value)
                  }
                  placeholder="Latte de avellanas"
                  className="mt-1 w-full rounded-xl border border-white/40 bg-(--surface) px-4 py-3 text-sm text-(--foreground) shadow-sm focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
                  required
                />
              </label>
              {myLocals.length <= 1 ? (
                <div className="text-sm font-semibold text-(--foreground)">
                  Local
                  <div className="mt-1 rounded-xl border border-white/40 bg-(--surface) px-4 py-3 text-sm text-(--muted-foreground)">
                    {myLocals[0]?.name ?? "Sin local"}
                  </div>
                </div>
              ) : (
                <label className="text-sm font-semibold text-(--foreground)">
                  Local
                  <select
                    value={form.localId}
                    onChange={(event) =>
                      handleFormChange("localId", event.target.value)
                    }
                    className="mt-1 w-full rounded-xl border border-white/40 bg-(--surface) px-4 py-3 text-sm text-(--foreground) shadow-sm focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
                    required
                  >
                    <option value="">Selecciona uno</option>
                    {myLocals.map((local) => (
                      <option key={local.id} value={local.id}>
                        {local.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            <label className="text-sm font-semibold text-(--foreground)">
              Categoría
              <select
                value={form.categoryId}
                onChange={(event) =>
                  handleFormChange("categoryId", event.target.value)
                }
                className="mt-1 w-full rounded-xl border border-white/40 bg-(--surface) px-4 py-3 text-sm text-(--foreground) shadow-sm focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
                required
              >
                <option value="">Selecciona una categoría</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                    {category.local_name ? ` · ${category.local_name}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-semibold text-(--foreground)">
              Descripción
              <textarea
                value={form.description}
                onChange={(event) =>
                  handleFormChange("description", event.target.value)
                }
                placeholder="Notas, origen o elaboración destacada"
                className="mt-1 h-24 w-full rounded-xl border border-white/40 bg-(--surface) px-4 py-3 text-sm text-(--foreground) shadow-sm focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
              />
            </label>

            <div className="rounded-2xl border border-white/10 bg-(--surface) p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-(--foreground)">
                  Etiquetas
                </p>
                {tagError ? (
                  <span className="text-xs text-red-500">{tagError}</span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-(--muted-foreground)">
                Usa etiquetas como “Sin gluten”, “Veggie” o “Edición limitada”
                para filtrar y destacar productos.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {availableTags.length === 0 ? (
                  <span className="text-xs text-(--muted-foreground)">
                    Aún no tienes etiquetas. Crea la primera abajo.
                  </span>
                ) : (
                  availableTags.map((tag) => {
                    const isActive = form.tagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => handleToggleTag(tag.id)}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                          isActive
                            ? "border-(--accent) bg-(--accent) text-white"
                            : "border-white/20 text-(--muted-foreground) hover:border-(--accent) hover:text-(--accent)"
                        }`}
                      >
                        {tag.name}
                      </button>
                    );
                  })
                )}
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
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
                  placeholder="Nombre de la etiqueta"
                  className="flex-1 rounded-xl border border-white/30 bg-(--surface-alt) px-4 py-2 text-sm text-(--foreground) shadow-sm focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
                />
                <button
                  type="button"
                  onClick={handleCreateTag}
                  disabled={tagSaving || !newTagName.trim()}
                  className="rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-(--muted-foreground) transition hover:border-(--accent) hover:text-(--accent) disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {tagSaving ? "Creando…" : "Crear etiqueta"}
                </button>
              </div>
            </div>

            <div
              className="grid gap-4 sm:grid-cols-[1fr_1fr_1fr]
            "
            >
              <label className="text-sm font-semibold text-(--foreground)">
                Precio
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price}
                  onChange={(event) =>
                    handleFormChange("price", event.target.value)
                  }
                  placeholder="3.50"
                  className="mt-1 w-full rounded-xl border border-white/40 bg-(--surface) px-4 py-3 text-sm text-(--foreground) shadow-sm focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
                  required
                />
              </label>

              <label className="text-sm font-semibold text-(--foreground)">
                Estado
                <select
                  value={form.state}
                  onChange={(event) =>
                    handleFormChange(
                      "state",
                      event.target.value as ProductFormState["state"]
                    )
                  }
                  className="mt-1 w-full rounded-xl border border-white/40 bg-(--surface) px-4 py-3 text-sm text-(--foreground) shadow-sm focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
                >
                  {Object.entries(PRODUCT_STATES).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="flex items-center gap-2 text-sm font-semibold text-(--foreground)">
              <input
                type="checkbox"
                checked={form.tracksStock}
                onChange={(event) =>
                  handleFormChange("tracksStock", event.target.checked)
                }
                className="h-4 w-4 rounded border-white/40 bg-(--surface) text-(--accent) focus:ring-(--accent)"
              />
              Seguir stock para este producto
            </label>

            {form.tracksStock ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="text-sm font-semibold text-(--foreground)">
                  Stock actual
                  <input
                    type="number"
                    min="0"
                    value={form.stock}
                    onChange={(event) =>
                      handleFormChange("stock", event.target.value)
                    }
                    placeholder="25"
                    className="mt-1 w-full rounded-xl border border-white/40 bg-(--surface) px-4 py-3 text-sm text-(--foreground) shadow-sm focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
                    required
                  />
                </label>
                <label className="text-sm font-semibold text-(--foreground)">
                  Umbral stock bajo
                  <input
                    type="number"
                    min="0"
                    value={form.lowStockThreshold}
                    onChange={(event) =>
                      handleFormChange("lowStockThreshold", event.target.value)
                    }
                    placeholder="5"
                    className="mt-1 w-full rounded-xl border border-white/40 bg-(--surface) px-4 py-3 text-sm text-(--foreground) shadow-sm focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
                    required
                  />
                </label>
                <label className="text-sm font-semibold text-(--foreground)">
                  Umbral crítico
                  <input
                    type="number"
                    min="0"
                    value={form.criticalStockThreshold}
                    onChange={(event) =>
                      handleFormChange(
                        "criticalStockThreshold",
                        event.target.value
                      )
                    }
                    placeholder="2"
                    className="mt-1 w-full rounded-xl border border-white/40 bg-(--surface) px-4 py-3 text-sm text-(--foreground) shadow-sm focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
                    required
                  />
                </label>
              </div>
            ) : (
              <label className="flex items-center gap-2 text-sm font-semibold text-(--foreground)">
                <input
                  type="checkbox"
                  checked={form.inStock}
                  onChange={(event) =>
                    handleFormChange("inStock", event.target.checked)
                  }
                  className="h-4 w-4 rounded border-white/40 bg-(--surface) text-(--accent) focus:ring-(--accent)"
                />
                Producto disponible actualmente
              </label>
            )}

            <label className="text-sm font-semibold text-(--foreground)">
              Imagen (URL)
              <input
                type="url"
                value={form.image_url}
                onChange={(event) =>
                  handleFormChange("image_url", event.target.value)
                }
                placeholder="https://"
                className="mt-1 w-full rounded-xl border border-white/40 bg-(--surface) px-4 py-3 text-sm text-(--foreground) shadow-sm focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
              />
            </label>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingProduct(null);
                  setForm({ ...EMPTY_FORM });
                }}
                className="rounded-full border border-white/30 px-5 py-2 text-sm font-semibold text-(--muted-foreground) transition hover:border-(--accent) hover:text-(--accent)"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-(--accent) px-6 py-2 text-sm font-semibold text-white transition hover:bg-(--accent-dark) disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saving
                  ? "Guardando…"
                  : editingProduct
                  ? "Guardar cambios"
                  : "Crear producto"}
              </button>
            </div>
          </form>
        ) : null}

        <div className="mt-8 space-y-3">
          <h3 className="text-lg font-semibold text-(--foreground)">
            Categorías disponibles
          </h3>
          {manageableCategories.length === 0 ? (
            <p className="text-sm text-(--muted-foreground)">
              Aún no creaste categorías personalizadas.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {manageableCategories.map((category) => {
                const isEditing = editingCategory?.id === category.id;
                const isActiveFilter =
                  categoryFilter !== "all" && categoryFilter === category.id;
                return (
                  <div
                    key={category.id}
                    className={`flex items-start justify-between gap-4 rounded-2xl border px-4 py-3 text-sm shadow-(--shadow-card) ${
                      isEditing
                        ? "border-(--accent) bg-(--surface-alt)"
                        : isActiveFilter
                        ? "border-(--accent) bg-(--surface-alt)"
                        : "border-white/12 bg-(--surface-alt)"
                    }`}
                  >
                    <div className="space-y-1">
                      <p className="font-semibold text-(--foreground)">
                        {category.name}
                      </p>
                      <p className="text-xs uppercase tracking-wide text-(--muted-foreground)">
                        {category.local_name ||
                          myLocals[0]?.name ||
                          "Sin local"}
                      </p>
                      <p className="text-xs text-(--muted-foreground)">
                        {category.tracks_stock
                          ? "Sigue stock"
                          : "Sin seguimiento"}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setCategoryFilter((current) =>
                            current === category.id ? "all" : category.id
                          )
                        }
                        className={`mt-2 inline-flex w-fit items-center justify-center rounded-full px-3 py-1 text-xs font-semibold transition ${
                          isActiveFilter
                            ? "bg-(--accent) text-white"
                            : "border border-white/25 text-(--muted-foreground) hover:border-(--accent) hover:text-(--accent)"
                        }`}
                      >
                        {isActiveFilter ? "Ver todas" : "Ver productos"}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleEditCategory(category)}
                      className="rounded-full border border-white/25 px-3 py-1 text-xs font-semibold text-(--muted-foreground) transition hover:border-(--accent) hover:text-(--accent)"
                    >
                      {isEditing ? "Editando" : "Editar"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-(--muted-foreground)">
            Actualiza tus datos de catálogo cuando hagas cambios importantes en
            tu oferta.
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleRefreshCategories}
              className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-(--muted-foreground) transition hover:border-(--accent) hover:text-(--accent)"
            >
              Recargar categorías
            </button>
            <button
              type="button"
              onClick={handleRefreshProducts}
              className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-(--muted-foreground) transition hover:border-(--accent) hover:text-(--accent)"
            >
              Recargar productos
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <label htmlFor="products-search" className="sr-only">
              Buscar productos
            </label>
            <input
              id="products-search"
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por nombre o descripción"
              className="w-full flex-1 rounded-full border border-white/20 bg-(--surface) px-4 py-2 text-sm text-(--foreground) shadow-sm focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/40"
            />
            <div className="sm:w-60">
              <label htmlFor="category-filter" className="sr-only">
                Filtrar por categoría
              </label>
              <select
                id="category-filter"
                value={categoryFilterValue}
                onChange={(event) => {
                  const value = event.target.value;
                  setCategoryFilter(value === "all" ? "all" : Number(value));
                }}
                className="w-full rounded-full border border-white/20 bg-(--surface) px-4 py-2 text-sm text-(--foreground) shadow-sm focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)/40"
              >
                <option value="all">Todas las categorías</option>
                {manageableCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {isFiltering ? (
            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                setCategoryFilter("all");
                setStockFilter("all");
              }}
              className="self-start rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-(--muted-foreground) transition hover:border-(--accent) hover:text-(--accent)"
            >
              Limpiar filtros
            </button>
          ) : null}
        </div>

        <div ref={productTableRef} className="mt-4 overflow-x-auto">
          <div className="inline-block min-w-full align-middle">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-(--muted-foreground)">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      if (header.isPlaceholder) {
                        return (
                          <th
                            key={header.id}
                            style={{ width: header.getSize() }}
                            className="pb-3 pr-4"
                          />
                        );
                      }
                      const paddingClass =
                        header.column.id === "actions" ? "pb-3" : "pb-3 pr-4";
                      return (
                        <th
                          key={header.id}
                          style={{ width: header.getSize() }}
                          className={`relative ${paddingClass}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span>
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                            </span>
                            {header.column.getCanResize() ? (
                              <span
                                role="separator"
                                aria-orientation="vertical"
                                onMouseDown={header.getResizeHandler()}
                                onTouchStart={header.getResizeHandler()}
                                className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none opacity-0 transition hover:opacity-100"
                              >
                                <span className="absolute right-0 top-1/2 h-6 w-px -translate-y-1/2 bg-(--accent)" />
                              </span>
                            ) : null}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-white/10">
                {tableRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={leafColumnCount}
                      className="py-8 text-center text-(--muted-foreground)"
                    >
                      {stockFilter === "critical"
                        ? "No hay productos con stock crítico en este momento."
                        : "Aún no tienes productos cargados en este catálogo."}
                    </td>
                  </tr>
                ) : (
                  tableRows.map((row) => (
                    <tr key={row.id} className="align-top">
                      {row.getVisibleCells().map((cell) => {
                        const paddingClass =
                          cell.column.id === "actions" ? "py-4" : "py-4 pr-4";
                        return (
                          <td
                            key={cell.id}
                            style={{ width: cell.column.getSize() }}
                            className={paddingClass}
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Reveal>

      {stockFilter === "critical" && criticalProducts.length > 0 ? (
        <Reveal className="rounded-3xl border border-yellow-200 bg-yellow-50/80 p-6 text-sm text-yellow-900 shadow-(--shadow-card)">
          <h3 className="text-base font-semibold">
            Productos con stock crítico
          </h3>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            {criticalProducts.map((product) => (
              <li key={product.id}>
                {product.name} · {product.local_name} · {product.stock} unidades
                · umbral crítico {product.critical_stock_threshold}
              </li>
            ))}
          </ul>
        </Reveal>
      ) : null}
    </div>
  );
}
