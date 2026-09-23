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
  yaCalificada: boolean;
  conversacionId: string;
}
