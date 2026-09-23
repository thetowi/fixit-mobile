// Espejo de fixit-web/types/busqueda.ts.

export interface PrestadorEncontrado {
  id: string;
  nombre: string;
  apellido: string;
  verificado: boolean;
  fotoPerfilUrl: string | null;
  descripcion: string | null;
  precioReferencia: number | null;
  distanciaKm: number | null;
  promedioCalificacion: number | null;
  cantidadCalificaciones: number;
}
