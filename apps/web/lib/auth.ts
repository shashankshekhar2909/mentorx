import type { Role, TokenPair } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/proxy";

type JwtPayload = {
  sub?: string;
  role?: Role;
};

function decodePayload(token: string): JwtPayload {
  const parts = token.split(".");
  if (parts.length < 2) return {};
  const payload = parts[1];
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(normalized);
    return JSON.parse(json) as JwtPayload;
  } catch {
    return {};
  }
}

export async function login(email: string, password: string): Promise<TokenPair> {
  const body = new URLSearchParams();
  body.append("username", email);
  body.append("password", password);

  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: body.toString()
  });

  if (!response.ok) {
    throw new Error("Invalid credentials");
  }

  return response.json() as Promise<TokenPair>;
}

export async function register(email: string, password: string, role: Role): Promise<TokenPair> {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password, role })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Registration failed");
  }

  return response.json() as Promise<TokenPair>;
}

export function extractSession(tokens: TokenPair) {
  const payload = decodePayload(tokens.access_token);
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    role: payload.role ?? "student",
    email: payload.sub ?? "unknown"
  };
}
