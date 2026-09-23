import * as SecureStore from "expo-secure-store";
import { API_URL } from "@/lib/config";
import { ApiError } from "@/lib/api";

// Subida de archivos (multipart/form-data) — apiFetch en api.ts siempre manda
// "Content-Type: application/json", así que para fotos/documentos usamos este helper aparte,
// mismo patrón que usa fixit-web con `fetch` directo + FormData en /cuenta.
const TOKEN_KEY = "fixit_token";

export interface ArchivoParaSubir {
  uri: string;
  name: string;
  type: string;
}

export async function apiUpload<T>(
  path: string,
  campos: Record<string, ArchivoParaSubir | string>,
  method: "POST" | "PUT" = "POST"
): Promise<T> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);

  const formData = new FormData();
  for (const [clave, valor] of Object.entries(campos)) {
    if (typeof valor === "string") {
      formData.append(clave, valor);
    } else {
      // React Native entiende este shape especial de FormData.append para archivos (no es un
      // Blob real como en el navegador, es una convención que soporta `fetch` de RN).
      formData.append(clave, { uri: valor.uri, name: valor.name, type: valor.type } as unknown as Blob);
    }
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new ApiError(errorBody?.error ?? "Ocurrió un error al subir el archivo", response.status);
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}
