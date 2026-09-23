import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { AppState } from "react-native";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/authContext";
import { Conversacion } from "@/types/conversaciones";

// Contador global de mensajes sin leer, para el circulito de la pestaña "Mensajes" en la barra de
// abajo (ver BarraDePestañas en src/app/(tabs)/_layout.tsx) — el mismo número que ya se mostraba
// por conversación en mensajes.tsx (c.mensajesNoLeidos), pero sumado entre todas las conversaciones
// y visible desde CUALQUIER pantalla, no solo estando parado en Mensajes.
//
// Se implementa como un store chico externo (useSyncExternalStore) en vez de useState adentro del
// Provider, para poder actualizar el número desde otras pantallas (ej. conversacion/[id].tsx al
// marcar como leído) sin tener que pasar callbacks para arriba y para abajo del árbol — cualquier
// componente puede llamar a refrescarConteoNoLeidos() importándola directo.
let total = 0;
const listeners = new Set<() => void>();

function set(nuevoTotal: number) {
  if (nuevoTotal === total) return;
  total = nuevoTotal;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return total;
}

// Se llama desde cualquier lado (conversacion/[id].tsx al leer un chat, o el polling de más abajo)
// para traer el número al día pegándole a la misma lista de conversaciones que ya usa la pantalla
// de Mensajes — no hace falta un endpoint nuevo en el backend.
export async function refrescarConteoNoLeidos(): Promise<void> {
  try {
    const conversaciones = await apiFetch<Conversacion[]>("/api/conversaciones/mias");
    actualizarConteoDesde(conversaciones);
  } catch {
    // silencioso, igual que el resto de los best-effort de esta pantalla — un badge desactualizado
    // no puede romper el resto de la app
  }
}

// Variante sin fetch propio: mensajes.tsx ya trae la lista de conversaciones para pintar la
// pantalla, así que reutiliza esa misma respuesta para actualizar el circulito en vez de pedirla
// dos veces al backend.
export function actualizarConteoDesde(conversaciones: Conversacion[]): void {
  set(conversaciones.reduce((suma, c) => suma + c.mensajesNoLeidos, 0));
}

export function useConteoNoLeidos(): number {
  return useSyncExternalStore(subscribe, getSnapshot, () => 0);
}

const INTERVALO_POLLING_MS = 20000;

// Provider chico: solo se encarga de mantener el número al día mientras hay sesión iniciada
// (polling cada 20s + al volver la app a primer plano), sin guardar el valor él mismo — el valor en
// sí vive en el store de arriba. Envuelve toda la navegación en el layout raíz (ver app/_layout.tsx)
// para que tanto la barra de pestañas como la pantalla de un chat individual puedan leer/actualizar
// el mismo número.
export function ConteoNoLeidosProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  const intervaloRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!usuario) {
      set(0);
      return;
    }

    refrescarConteoNoLeidos();
    intervaloRef.current = setInterval(refrescarConteoNoLeidos, INTERVALO_POLLING_MS);

    const suscripcion = AppState.addEventListener("change", (estado) => {
      if (estado === "active") refrescarConteoNoLeidos();
    });

    return () => {
      if (intervaloRef.current) clearInterval(intervaloRef.current);
      suscripcion.remove();
    };
  }, [usuario]);

  return <>{children}</>;
}
