import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { AppState } from "react-native";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/authContext";
import { suscribirseAActividadOrdenes } from "@/lib/actividadOrdenesContext";

// Contador global de notificaciones sin leer (03/10, a pedido del usuario: "algo como
// 'Notificaciones' donde alojemos todas las notificaciones disponibles o no leidas") — mismo
// patrón de store chico externo que conteoNoLeidosContext.tsx (el badge de "Mensajes"), para poder
// actualizarse desde cualquier pantalla (ej. notificaciones.tsx al marcar como leída) sin pasar
// callbacks por todo el árbol.
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

// Pega contra el contador dedicado del backend (GET /api/notificaciones/no-leidas-contador, ver
// NotificacionesController) en vez de traer la lista completa — misma idea que el badge de chat,
// pero sin necesidad de reconstruir el total a mano acá.
export async function refrescarConteoNotificaciones(): Promise<void> {
  try {
    const { cantidad } = await apiFetch<{ cantidad: number }>("/api/notificaciones/no-leidas-contador");
    set(cantidad);
  } catch {
    // best-effort, igual que el resto de los contadores de esta app
  }
}

// Variante sin fetch propio: notificaciones.tsx ya trae la lista completa para pintar la pantalla,
// así que reusa esa respuesta para no pedir el contador dos veces.
export function actualizarConteoDesde(notificaciones: { leida: boolean }[]): void {
  set(notificaciones.filter((n) => !n.leida).length);
}

export function marcarTodasLeidasLocal(): void {
  set(0);
}

export function useConteoNotificaciones(): number {
  return useSyncExternalStore(subscribe, getSnapshot, () => 0);
}

const INTERVALO_POLLING_MS = 20000;

// Provider chico, mismo patrón que ConteoNoLeidosProvider: polling cada 20s + al volver la app a
// primer plano, MÁS una suscripción a "ActualizacionOrdenes" (ver actividadOrdenesContext.tsx) para
// refrescar más rápido cuando la notificación viene de un cambio de orden (pausar/reanudar, pago,
// agenda, etc. — ver los 13 call-sites de PushNotificationService.NotificarAsync). Las que llegan
// por chat ("NuevaActividad") se cubren con el polling nomás, igual que ya pasaba antes.
export function NotificacionesProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  const intervaloRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!usuario) {
      set(0);
      return;
    }

    refrescarConteoNotificaciones();
    intervaloRef.current = setInterval(refrescarConteoNotificaciones, INTERVALO_POLLING_MS);

    const suscripcion = AppState.addEventListener("change", (estado) => {
      if (estado === "active") refrescarConteoNotificaciones();
    });
    const desuscribirOrdenes = suscribirseAActividadOrdenes(refrescarConteoNotificaciones);

    return () => {
      if (intervaloRef.current) clearInterval(intervaloRef.current);
      suscripcion.remove();
      desuscribirOrdenes();
    };
  }, [usuario]);

  return <>{children}</>;
}
