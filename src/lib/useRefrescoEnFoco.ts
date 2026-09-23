import { useCallback, useRef } from "react";
import { useFocusEffect } from "expo-router";
import { AppState, AppStateStatus } from "react-native";

interface Opciones {
  intervaloMs?: number;
  // true cuando la pantalla ya tiene su propio efecto de carga inicial al montar (ej. agenda.tsx),
  // para no pedir los mismos datos dos veces apenas se abre la pantalla por primera vez.
  saltarPrimerFoco?: boolean;
}

// Mantiene una pantalla al día sola mientras el usuario la tiene abierta, sin que tenga que salir
// de la app para verlo (22/09, a pedido del usuario: "inicio agenda ordenes... no se recarga
// automaticamente... tengo que salir de la app y se recarga"). Hasta ahora, Inicio/Agenda/Órdenes
// solo se refrescaban al volver a esa pestaña (useFocusEffect) — si el usuario se quedaba parado
// en la pantalla mientras pasaba algo en otro lado (ej. un Admin marcaba una orden como pagada, o
// llegaba un turno nuevo para programar), no había ningún mecanismo que lo detectara. Se agrega el
// mismo criterio que ya usa el badge de mensajes (conteoNoLeidosContext.tsx: polling cada 20s +
// refresco al volver la app a primer plano), pero acotado a la pantalla que llama a este hook en
// vez de vivir en la raíz de toda la app, y sumado al refresco al volver a esta pestaña.
export function useRefrescoEnFoco(refrescar: () => void, opciones: Opciones = {}) {
  const { intervaloMs = 20000, saltarPrimerFoco = false } = opciones;

  // Ref para no depender de que `refrescar` sea estable entre renders — evita reinstalar el
  // interval/listener en cada render solo porque el caller pasó una función nueva.
  const refrescarRef = useRef(refrescar);
  refrescarRef.current = refrescar;

  const primeraVezRef = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (saltarPrimerFoco && primeraVezRef.current) {
        primeraVezRef.current = false;
      } else {
        refrescarRef.current();
      }

      const intervalo = setInterval(() => refrescarRef.current(), intervaloMs);
      const suscripcion = AppState.addEventListener("change", (estado: AppStateStatus) => {
        if (estado === "active") refrescarRef.current();
      });

      return () => {
        clearInterval(intervalo);
        suscripcion.remove();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [intervaloMs, saltarPrimerFoco])
  );
}
