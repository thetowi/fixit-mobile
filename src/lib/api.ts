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

// Sesión vencida (26/10): el JWT dura 7 días (ver JwtService en fixit-api). Antes, cuando vencía,
// la app seguía "logueada" (el usuario se restaura de SecureStore) pero todo lo que pedía al
// backend devolvía 401 — incluido el chat en vivo ("Failed to complete negotiation ... 401").
// AuthProvider registra acá su cerrarSesion para que un 401 con token mande de vuelta al login.
// Se hace con un callback y no importando authContext para no armar un ciclo de imports.
let alExpirarSesion: (() => void) | null = null;

export function registrarAlExpirarSesion(fn: (() => void) | null): void {
  alExpirarSesion = fn;
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

  // /api/auth/* (login, Google) devuelve 401 por credenciales incorrectas: eso no es sesión vencida.
  if (response.status === 401 && token && !path.startsWith("/api/auth/")) {
    alExpirarSesion?.();
    throw new ApiError("Tu sesión venció. Volvé a iniciar sesión.", 401);
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    // 27/10: antes todo error sin cuerpo decía solo "Ocurrió un error", y no había forma de saber
    // si era un endpoint que el servidor todavía no tiene (404, backend sin publicar) o un error
    // del servidor (500). Ahora el mensaje dice cuál de los dos es.
    let mensaje: string = errorBody?.error ?? errorBody?.title ?? "";
    if (!mensaje) {
      if (response.status === 404) mensaje = "El servidor todavía no tiene esta función (404). Falta publicar la actualización del backend.";
      else if (response.status >= 500) mensaje = `Error del servidor (${response.status}). Probá de nuevo en un rato.`;
      else mensaje = `Ocurrió un error (${response.status}).`;
    }
    throw new ApiError(mensaje, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}
