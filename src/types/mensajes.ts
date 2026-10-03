// Espejo de fixit-web/types/mensajes.ts.
export interface Mensaje {
  id: string;
  conversacionId: string;
  emisorId: string;
  emisorNombre: string;
  tipo: "Texto" | "Imagen" | "Oferta" | "Audio" | "Video" | "Turno" | "Visita";
  contenido: string | null;
  archivoUrl: string | null;
  duracionSegundos: number | null;
  // Onda real del audio (03/10), calculada por el backend con ffmpeg al subir el archivo — array
  // de amplitudes normalizadas 0..1, o null si no se pudo analizar (ver FfmpegWaveformService.cs),
  // en cuyo caso el reproductor cae a un patrón decorativo fijo. Solo aplica si tipo === "Audio".
  picos: number[] | null;
  montoOferta: number | null;
  descripcionOferta: string | null;
  ofertaVigente: boolean;
  ofertaExpiraEn: string | null;
  ofertaPagada: boolean;
  // Fecha en que se agendó/reprogramó el turno de la Orden de esta oferta (24/09) — ver
  // FixIt.Domain.Entities.Mensaje.OfertaAgendadaEn en el backend.
  ofertaAgendadaEn: string | null;
  // Turno agendado enviado al chat (22/09) — ver AgendaService.ProgramarTurnoAsync en el backend.
  turnoOrdenId: string | null;
  turnoFechaHora: string | null;
  turnoDuracionMinutos: number | null;
  turnoVigente: boolean;
  // Visita a domicilio para presupuestar (30/09) — paso opcional antes de la Oferta, ver
  // VisitaService.ProgramarAsync en el backend.
  visitaId: string | null;
  // Título corto puesto por el prestador al agendar (30/09, ej. "Presupuesto pintura living").
  visitaTitulo: string | null;
  visitaFechaHora: string | null;
  visitaDuracionMinutos: number | null;
  visitaVigente: boolean;
  // "Programada" | "Realizada" | "Cancelada" (30/09) — refleja el estado real de la Visita,
  // persistido en el mensaje (no depende de haber estado conectado en vivo al momento del cambio).
  visitaEstado: "Programada" | "Realizada" | "Cancelada" | null;
  enviadoEn: string;
}
