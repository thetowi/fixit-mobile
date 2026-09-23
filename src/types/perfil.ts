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
