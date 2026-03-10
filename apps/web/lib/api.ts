import { useAuthStore } from "@/lib/auth-store";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/proxy";
const WS_API_BASE = process.env.NEXT_PUBLIC_WS_API_BASE_URL;
const API_WS_PORT = process.env.NEXT_PUBLIC_API_WS_PORT ?? "8002";

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

export function apiWsUrl(path: string): string {
  if (WS_API_BASE) {
    return `${WS_API_BASE}${path}`;
  }

  if (typeof window !== "undefined") {
    if (API_BASE.startsWith("http://") || API_BASE.startsWith("https://")) {
      const absolute = new URL(API_BASE);
      const proto = absolute.protocol === "https:" ? "wss:" : "ws:";
      return `${proto}//${absolute.host}${absolute.pathname}${path}`;
    }

    if (API_BASE.startsWith("/api/proxy")) {
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      return `${proto}://${window.location.hostname}:${API_WS_PORT}/api${path}`;
    }

    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${window.location.host}${API_BASE}${path}`;
  }

  return path;
}

export async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = useAuthStore.getState().session?.accessToken;
  const headers = new Headers(init.headers ?? {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(apiUrl(path), { ...init, headers });
  if (response.status === 401) {
    useAuthStore.getState().clearSession();
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
  }
  return response;
}

export async function parseJsonSafe(response: Response): Promise<any> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { detail: text };
  }
}
