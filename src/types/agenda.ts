// Espejo de fixit-web/types/agenda.ts.

export interface BloqueDisponibilidad {
  id: number;
  diaSemana: number; // 0 = Domingo, 1 = Lunes, ... 6 = Sábado (igual que DayOfWeek de .NET)
  horaInicio: string; // "09:00:00"
  horaFin: string;
}

export interface AgregarBloqueRequest {
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
}

export interface OrdenAgenda {
  id: string;
  // "Trabajo" o "Visita" (30/09) — ver el comentario equivalente en fixit-web/types/agenda.ts.
  tipo: "Trabajo" | "Visita";
  categoriaNombre: string;
  clienteNombreCompleto: string;
  clienteDireccion: string | null;
  clienteDireccionVerificada: boolean;
  clienteDireccionLat: number | null;
  clienteDireccionLon: number | null;
  clienteDistanciaKm: number | null;
  clienteTelefono: string | null;
  descripcion: string;
  estado: string;
  fechaHoraProgramada: string | null;
  duracionMinutos: number | null;
}

export interface ProgramarTurnoRequest {
  fechaHora: string;
  duracionMinutos: number;
}

// Opciones de duración predefinidas para el selector del formulario de "Programar turno".
export const DURACIONES_PREDEFINIDAS_MINUTOS = [30, 60, 90, 120, 180, 240, 300, 360, 420, 480];

export function formatoDuracion(minutos: number): string {
  const horas = Math.floor(minutos / 60);
  const mins = minutos % 60;
  if (horas === 0) return `${mins} min`;
  if (mins === 0) return `${horas}h`;
  return `${horas}h ${mins}min`;
}

// "queda a X km de tu ubicación" / "queda a X m de tu ubicación" (para distancias cortas)
export function formatoDistancia(km: number): string {
  if (km < 1) return `queda a ${Math.round(km * 1000)} m de tu ubicación`;
  return `queda a ${km.toFixed(1)} km de tu ubicación`;
}
