// Espejo de fixit-web/types/categorias.ts.
import { EstadoVerificacion } from "./verificacion";

export interface Categoria {
  id: number;
  nombre: string;
  icono: string | null;
}

export interface PrestadorCategoria {
  id: number;
  categoriaId: number;
  categoriaNombre: string;
  descripcion: string | null;
  precioReferencia: number | null;
  estadoVerificacion: EstadoVerificacion;
  motivoRechazoVerificacion: string | null;
}

export interface AgregarCategoriaRequest {
  categoriaId: number;
  descripcion?: string;
  precioReferencia?: number;
}
