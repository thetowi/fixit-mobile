import * as SecureStore from "expo-secure-store";
import { API_URL } from "@/lib/config";

// Mismo patrón que fixit-web/lib/api.ts (ApiError + apiFetch genérico), adaptado para leer el
// token de SecureStore (async) en vez de localStorage (sync) — SecureStore es el almacén cifrado
// del sistema operativo (Keychain en iOS, Keystore en Android), la forma correcta de guardar un
// JWT en una app nativa; localStorage no existe en React Native.
const TOKEN_KEY = "fixit_token";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new ApiError(errorBody?.error ?? "Ocurrió un error", response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}
