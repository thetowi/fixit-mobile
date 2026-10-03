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
}
