import { useEffect, useRef, type ReactNode } from "react";
import * as signalR from "@microsoft/signalr";
import { crearConexionChat } from "@/lib/chatConnection";
import { useAuth } from "@/lib/authContext";

// Refresco en tiempo real de Inicio/Agenda/Órdenes (23/09, ver backlog ítem 13 de la Tanda 2 —
// "mejorar el refresh de las páginas por eventos, hoy es polling"). Hasta ahora esas tres
// pantallas se mantenían al día solo con polling cada 20s (ver useRefrescoEnFoco), porque no
// existía ninguna conexión de SignalR viva a nivel de toda la app — solo el chat individual
// (conversacion/[id].tsx) abría la suya propia. Este archivo agrega esa conexión persistente,
// unida al grupo "usuario-{id}" (el mismo que el backend ya usa para "NuevaActividad" del chat,
// ver ChatHub.UnirseAMisNotificaciones), y expone una forma simple de suscribirse al evento nuevo
// "ActualizacionOrdenes" (ver FixIt.Api/Hubs/ActividadOrdenesNotifier.cs) sin depender de React
// Context para la suscripción en sí — así useRefrescoEnFoco puede escucharlo con un simple
// addEventListener/removeEventListener, igual que ya hace con AppState.
//
// El polling de useRefrescoEnFoco NO se saca del todo: queda como red de seguridad con un
// intervalo más largo (ver el cambio de default en useRefrescoEnFoco.ts), por si la conexión de
// SignalR se cae un rato (mala señal, app en segundo plano mucho tiempo) — el evento en vivo cubre
// el caso normal, el polling cubre el caso raro.
const listeners = new Set<() => void>();

function emitir() {
  listeners.forEach((l) => l());
}

// Suscribirse a "algo cambió en mis órdenes". Devuelve la función para desuscribirse — mismo
// patrón que un addEventListener común.
export function suscribirseAActividadOrdenes(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Provider chico, montado una sola vez en la raíz de la app (ver src/app/_layout.tsx) — igual que
// ConteoNoLeidosProvider, no guarda ningún valor él mismo, solo mantiene viva la conexión mientras
// haya sesión iniciada y avisa a quien esté escuchando cuando llega el evento.
export function ActividadOrdenesProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  const conexionRef = useRef<signalR.HubConnection | null>(null);

  useEffect(() => {
    if (!usuario) return;

    let cancelado = false;

    async function conectar() {
      const conexion = await crearConexionChat();
      conexionRef.current = conexion;

      conexion.on("ActualizacionOrdenes", () => {
        emitir();
      });

      // Si se corta y reconecta sola (withAutomaticReconnect, ver crearConexionChat), hay que
      // volver a unirse al grupo — mismo fix que ya se aplicó para el chat (ver backlog, "Fix de
      // reconexión de SignalR para notificaciones").
      conexion.onreconnected(() => {
        conexion.invoke("UnirseAMisNotificaciones").catch(() => {});
      });

      try {
        await conexion.start();
        if (cancelado) {
          await conexion.stop();
          return;
        }
        await conexion.invoke("UnirseAMisNotificaciones");
      } catch {
        // Best-effort: sin esto, las pantallas siguen andando igual con el polling de
        // useRefrescoEnFoco como red de seguridad — no rompemos nada del resto de la app.
      }
    }

    conectar();

    return () => {
      cancelado = true;
      conexionRef.current?.stop();
      conexionRef.current = null;
    };
  }, [usuario]);

  return <>{children}</>;
}
