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

// Convierte el archivo local (uri de expo-image-picker/expo-audio, tipo "file://...") en un Blob
// real. Hasta hace poco, React Native aceptaba mandar directamente `{ uri, name, type }` como
// "parte" de un FormData sin ser un Blob de verdad — una convención propia de RN que su `fetch`
// nativo reconocía como caso especial. En la versión de RN que trae este SDK de Expo (57), esa
// convención vieja ya no funciona: tira "Unsupported FormData part implementation" (30/09,
// reportado por el usuario, rompía tanto fotos como audios porque ambos pasan por esta misma
// función). El arreglo es pedirle a `fetch` que lea el archivo local y nos dé un Blob real, y
// mandar ESE Blob — soporta cualquier archivo local, y es la forma que sigue funcionando tanto en
// RN nuevo como en la web.
async function archivoABlob(archivo: ArchivoParaSubir): Promise<Blob> {
  const respuestaLocal = await fetch(archivo.uri);
  const blobCrudo = await respuestaLocal.blob();
  // Forzamos el Content-Type que ya sabíamos que correspondía (ej. "audio/mp4" para la nota de
  // voz) — el que trae el Blob leído del archivo puede venir vacío o distinto según la plataforma.
  return new Blob([blobCrudo], { type: archivo.type });
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
      const blob = await archivoABlob(valor);
      formData.append(clave, blob, valor.name);
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
