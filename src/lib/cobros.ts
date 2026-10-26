// Nuevo sistema de cobros (26/10): la app pregunta al backend en qué modo está
// (GET /api/publico/config) para mostrar "Aceptar oferta" (Directo: el cliente le paga directo al
// profesional) o "Pagar con Mercado Pago" (Retenido: el modelo anterior). Espejo de
// fixit-web/lib/cobros.ts: se pide una sola vez por sesión de la app y se comparte entre pantallas.
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { ConfigPublica } from "@/types/cobros";

let pedido: Promise<ConfigPublica | null> | null = null;

export function obtenerConfigCobros(): Promise<ConfigPublica | null> {
  if (!pedido) {
    pedido = apiFetch<ConfigPublica>("/api/publico/config").catch(() => {
      pedido = null; // si falló, que el próximo intente de nuevo
      return null;
    });
  }
  return pedido;
}

// null mientras carga (o si el backend todavía no tiene el endpoint): las pantallas no muestran
// ni "Aceptar" ni "Pagar" hasta saberlo, para no ofrecer una acción equivocada.
export function useConfigCobros(): ConfigPublica | null {
  const [config, setConfig] = useState<ConfigPublica | null>(null);
  useEffect(() => {
    let activo = true;
    obtenerConfigCobros().then((c) => {
      if (activo) setConfig(c);
    });
    return () => {
      activo = false;
    };
  }, []);
  return config;
}

export function pesos(monto: number): string {
  return `$${Math.round(monto).toLocaleString("es-AR")}`;
}

// "2026-11" -> "Noviembre 2026"
export function nombrePeriodo(periodo: string): string {
  const [anio, mes] = periodo.split("-").map(Number);
  const texto = new Date(anio, mes - 1, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// Mismo valor que ReglasNegocio.HorasAutoConfirmacion en el backend.
export const HORAS_AUTO_CONFIRMACION = 72;
