// Espejo de fixit-web/types/perfil.ts.

export interface ServicioOfrecido {
  categoriaId: number;
  categoriaNombre: string;
  descripcion: string | null;
  precioReferencia: number | null;
}

export interface FotoTrabajo {
  id: string;
  url: string;
  descripcion: string | null;
  // Repost de foto de reseña (03/10, mismo campo que fixit-web/types/perfil.ts): esta foto no la
  // subió el prestador, viene de una reseña de un cliente que él pidió permiso para mostrar y el
  // cliente aprobó.
  esDeResenia: boolean;
  clienteNombre: string | null;
}

export interface PerfilPrestador {
  id: string;
  nombre: string;
  apellido: string;
  verificado: boolean;
  fotoPerfilUrl: string | null;
  miembroDesde: string;
  promedioCalificacion: number | null;
  cantidadCalificaciones: number;
  biografia: string | null;
  radioAlcanceKm: number | null;
  fotosTrabajo: FotoTrabajo[];
  servicios: ServicioOfrecido[];
}
