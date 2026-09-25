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
}
