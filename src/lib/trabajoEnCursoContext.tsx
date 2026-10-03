import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/authContext";
import { suscribirseAActividadOrdenes } from "@/lib/actividadOrdenesContext";
import { OrdenEnCurso } from "@/types/ordenes";
import TrabajoEnCursoOverlay from "@/components/TrabajoEnCursoOverlay";

// "Trabajo en curso" (24/09, a pedido del usuario): pantalla completa animada con timer en vivo
// que aparece en el Inicio de Cliente y Prestador apenas se inicia un trabajo, y que se puede
// minimizar a un banner fijo arriba de toda la app — se mantiene ahí hasta que el CLIENTE la
// finaliza. Sincronizada en tiempo real para los dos: reusa el mismo mecanismo de
// actividadOrdenesContext.tsx (evento SignalR "ActualizacionOrdenes") para saber cuándo volver a
// preguntarle al backend "¿tengo algo en curso ahora mismo?" (GET /api/ordenes/en-curso, ver
// FixIt.Api/Controllers/OrdenesController.cs).
interface TrabajoEnCursoContextValue {
  ordenEnCurso: OrdenEnCurso | null;
  minimizado: boolean;
  minimizar: () => void;
  expandir: () => void;
  finalizando: boolean;
  errorFinalizar: string | null;
  finalizarTrabajo: () => Promise<void>;
  // Pausar trabajo en curso (03/10, a pedido del usuario: "poder pausar un trabajo en curso para
  // continuar al otro día") — solo el Prestador decide (ver TrabajoEnCursoOverlay.tsx).
  pausando: boolean;
  reanudando: boolean;
  errorPausa: string | null;
  pausarTrabajo: (nota?: string) => Promise<void>;
  reanudarTrabajo: () => Promise<void>;
}

const TrabajoEnCursoContext = createContext<TrabajoEnCursoContextValue | null>(null);

export function useTrabajoEnCurso() {
  const ctx = useContext(TrabajoEnCursoContext);
  if (!ctx) throw new Error("useTrabajoEnCurso se tiene que usar adentro de <TrabajoEnCursoProvider>");
  return ctx;
}

export function TrabajoEnCursoProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  const [ordenEnCurso, setOrdenEnCurso] = useState<OrdenEnCurso | null>(null);
  const [minimizado, setMinimizado] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [errorFinalizar, setErrorFinalizar] = useState<string | null>(null);
  const [pausando, setPausando] = useState(false);
  const [reanudando, setReanudando] = useState(false);
  const [errorPausa, setErrorPausa] = useState<string | null>(null);

  const ordenIdAnteriorRef = useRef<string | null>(null);

  const refrescar = useCallback(async () => {
    if (!usuario) return;
    try {
      const data = await apiFetch<OrdenEnCurso | undefined>("/api/ordenes/en-curso");
      setOrdenEnCurso(data ?? null);
    } catch {
      // Best-effort: si falla, simplemente no mostramos/actualizamos el overlay esta vez —
      // el próximo evento de "ActualizacionOrdenes" o el polling de useRefrescoEnFoco de la
      // pantalla activa va a volver a intentarlo.
    }
  }, [usuario]);

  useEffect(() => {
    if (!usuario) {
      setOrdenEnCurso(null);
      setMinimizado(false);
      return;
    }
    refrescar();
    const desuscribir = suscribirseAActividadOrdenes(refrescar);
    return desuscribir;
  }, [usuario, refrescar]);

  // Cada vez que aparece un trabajo en curso NUEVO (distinto id al que había antes, incluyendo
  // "no había ninguno"), lo mostramos a pantalla completa — si el usuario ya lo había minimizado
  // antes, al finalizar y empezar otro no debería quedar escondido sin que se dé cuenta.
  useEffect(() => {
    const idActual = ordenEnCurso?.ordenId ?? null;
    if (idActual !== ordenIdAnteriorRef.current) {
      setMinimizado(false);
      setErrorFinalizar(null);
    }
    ordenIdAnteriorRef.current = idActual;
  }, [ordenEnCurso?.ordenId]);

  const pausarTrabajo = useCallback(
    async (nota?: string) => {
      if (!ordenEnCurso) return;
      setPausando(true);
      setErrorPausa(null);
      try {
        await apiFetch(`/api/ordenes/${ordenEnCurso.ordenId}/pausar`, {
          method: "PUT",
          body: JSON.stringify({ nota: nota?.trim() || undefined }),
        });
        setOrdenEnCurso((prev) =>
          prev ? { ...prev, pausadoEn: new Date().toISOString(), notaPausa: nota?.trim() || null } : prev
        );
      } catch (err) {
        setErrorPausa(err instanceof ApiError ? err.message : "No pudimos pausar el trabajo.");
      } finally {
        setPausando(false);
      }
    },
    [ordenEnCurso]
  );

  const reanudarTrabajo = useCallback(async () => {
    if (!ordenEnCurso) return;
    setReanudando(true);
    setErrorPausa(null);
    try {
      await apiFetch(`/api/ordenes/${ordenEnCurso.ordenId}/reanudar`, { method: "PUT" });
      setOrdenEnCurso((prev) => (prev ? { ...prev, pausadoEn: null, notaPausa: null } : prev));
    } catch (err) {
      setErrorPausa(err instanceof ApiError ? err.message : "No pudimos reanudar el trabajo.");
    } finally {
      setReanudando(false);
    }
  }, [ordenEnCurso]);

  const finalizarTrabajo = useCallback(async () => {
    if (!ordenEnCurso) return;
    setFinalizando(true);
    setErrorFinalizar(null);
    try {
      await apiFetch(`/api/ordenes/${ordenEnCurso.ordenId}/completar`, { method: "PUT" });
      setOrdenEnCurso(null);
    } catch (err) {
      setErrorFinalizar(err instanceof ApiError ? err.message : "No pudimos finalizar el trabajo.");
    } finally {
      setFinalizando(false);
    }
  }, [ordenEnCurso]);

  return (
    <TrabajoEnCursoContext.Provider
      value={{
        ordenEnCurso,
        minimizado,
        minimizar: () => setMinimizado(true),
        expandir: () => setMinimizado(false),
        finalizando,
        errorFinalizar,
        finalizarTrabajo,
        pausando,
        reanudando,
        errorPausa,
        pausarTrabajo,
        reanudarTrabajo,
      }}
    >
      {children}
      <TrabajoEnCursoOverlay />
    </TrabajoEnCursoContext.Provider>
  );
}
