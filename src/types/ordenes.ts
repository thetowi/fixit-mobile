// Espejo de fixit-web/types/ordenes.ts.

export interface CrearOrdenRequest {
  prestadorId: string;
  categoriaId: number;
  montoTotal: number;
}

export interface Orden {
  id: string;
  prestadorId: string;
  prestadorNombreCompleto: string;
  clienteId: string;
  clienteNombreCompleto: string;
  categoriaId: number;
  categoriaNombre: string;
  descripcion: string;
  estado: string;
  montoTotal: number;
  comisionPlataforma: number;
  creadoEn: string;
  // Agregados 24/09 para el aviso de "Hoy" en el Inicio del Cliente.
  fechaHoraProgramada: string | null;
  duracionMinutos: number | null;
  yaCalificada: boolean;
  conversacionId: string;
  // Pausar trabajo en curso (03/10, ver backend Orden.PausadoEn).
  pausadoEn?: string | null;
  notaPausa?: string | null;

  // Nuevo sistema de cobros (26/10, espejo de fixit-web/types/ordenes.ts). codigoCierre solo viene
  // para el cliente de la orden: es lo que le dicta al profesional al terminar.
  yaCalificadaComoCliente?: boolean;
  codigoCierre?: string | null;
  codigoCierreBloqueado?: boolean;
  terminadoPorPrestadorEn?: string | null;
  confirmacionTipo?: "Cliente" | "Codigo" | "Automatica" | "Admin" | null;
  problemaClienteReportadoEn?: string | null;
  problemaClienteComentario?: string | null;
  checkInEn?: string | null;
  checkInDistanciaMetros?: number | null;
  // Resolución de disputas por Oficy (27/10): a favor de quién y la nota que ven las dos partes.
  disputaResueltaEn?: string | null;
  disputaResolucion?: "Cliente" | "Prestador" | null;
  disputaNotaAdmin?: string | null;
  inasistenciaClienteReportadaEn?: string | null;
  inasistenciaResueltaEn?: string | null;
  inasistenciaResolucion?: string | null;
}

// "Trabajo en curso" (24/09): espejo de FixIt.Application.DTOs.Ordenes.OrdenEnCursoResponse.
export interface OrdenEnCurso {
  ordenId: string;
  categoriaNombre: string;
  categoriaIcono: string | null;
  descripcion: string;
  clienteId: string;
  clienteNombreCompleto: string;
  prestadorId: string;
  prestadorNombreCompleto: string;
  iniciadoEn: string;
  // Pausar trabajo en curso (03/10) — pausadoEn != null congela el timer y muestra el estado
  // "Pausado" en vez de "en vivo" (ver TrabajoEnCursoOverlay.tsx).
  pausadoEn: string | null;
  notaPausa: string | null;
  // 27/10: el prestador tocó "Terminé" y se espera la confirmación del cliente (solo le llega al
  // cliente: al prestador el backend ya no le devuelve la orden como en curso).
  terminadoPorPrestadorEn?: string | null;
}
