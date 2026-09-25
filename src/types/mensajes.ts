// Espejo de fixit-web/types/mensajes.ts.
export interface Mensaje {
  id: string;
  conversacionId: string;
  emisorId: string;
  emisorNombre: string;
  tipo: "Texto" | "Imagen" | "Oferta" | "Audio" | "Video" | "Turno";
  contenido: string | null;
  archivoUrl: string | null;
  duracionSegundos: number | null;
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
  enviadoEn: string;
}
