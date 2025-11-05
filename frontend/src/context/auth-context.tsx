"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";

type AuthUser = {
  username: string;
  role?: string;
};

type AuthTokens = {
  access: string;
  refresh: string;
};

type AuthSnapshot = {
  tokens: AuthTokens | null;
  user: AuthUser | null;
};

type LoginCredentials = {
  username: string;
  password: string;
};

type RegisterPayload = LoginCredentials & {
  email?: string;
  role?: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  accessToken: string | null;
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  error: string | null;
  clearError: () => void;
};

const STORAGE_KEY = "coffeefy-auth";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as AuthSnapshot;
        setTokens(parsed.tokens);
        setUser(parsed.user);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setLoading(false);
  }, []);

  const persist = useCallback(
    (nextTokens: AuthTokens | null, nextUser: AuthUser | null) => {
      if (typeof window === "undefined") return;
      if (!nextTokens) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      const snapshot: AuthSnapshot = {
        tokens: nextTokens,
        user: nextUser,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    },
    []
  );

  const logout = useCallback(() => {
    setTokens(null);
    setUser(null);
    persist(null, null);
    router.push("/");
  }, [persist, router]);

  const loadUserProfile = useCallback(
    async (authTokens: AuthTokens, username: string) => {
      try {
        const data = await apiFetch<Array<{ username: string; role?: string }>>(
          "/api/users/",
          {
            token: authTokens.access,
          }
        );
        const found = data.find((item) => item.username === username);
        if (found) {
          const enriched: AuthUser = {
            username: found.username,
            role: found.role,
          };
          setUser(enriched);
          persist(authTokens, enriched);
          return enriched;
        }
      } catch (profileError) {
        console.error("No se pudo cargar el perfil del usuario", profileError);
      }
      return null;
    },
    [persist]
  );

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      setLoading(true);
      setError(null);
      try {
        const tokenResponse = await apiFetch<AuthTokens>("/api/token/", {
          method: "POST",
          body: credentials,
        });

        setTokens(tokenResponse);
        const baseUser: AuthUser = { username: credentials.username };
        setUser(baseUser);
        persist(tokenResponse, baseUser);

        let targetRole: string | undefined = baseUser.role;
        const loadedProfile = await loadUserProfile(
          tokenResponse,
          credentials.username
        );
        if (loadedProfile?.role) {
          targetRole = loadedProfile.role;
        }

        const destination =
          targetRole === "cliente" ? "/cliente" : "/dashboard";
        router.push(destination);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(
            err.details ? JSON.stringify(err.details) : "Credenciales inválidas"
          );
        } else {
          setError("No se pudo iniciar sesión, inténtalo nuevamente.");
        }
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [loadUserProfile, persist, router]
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      setLoading(true);
      setError(null);
      try {
        await apiFetch("/api/users/", {
          method: "POST",
          body: {
            username: payload.username,
            password: payload.password,
            email: payload.email,
            role: payload.role ?? "cliente",
          },
        });
        await login({ username: payload.username, password: payload.password });
      } catch (err) {
        if (err instanceof ApiError) {
          setError(
            err.details
              ? JSON.stringify(err.details)
              : "No se pudo registrar el usuario."
          );
        } else {
          setError("Ocurrió un error inesperado durante el registro.");
        }
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [login]
  );

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken: tokens?.access ?? null,
      loading,
      login,
      register,
      logout,
      error,
      clearError,
    }),
    [user, tokens?.access, loading, login, register, logout, error, clearError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext debe usarse dentro de un AuthProvider");
  }
  return context;
}
