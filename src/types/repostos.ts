// "Repostear" fotos de reseña — espejo de fixit-web/types/repostos.ts (y de los DTOs en
// FixIt.Application.DTOs.Repostos).
export interface RepostoPendiente {
  calificacionFotoId: string;
  url: string;
  prestadorId: string;
  prestadorNombreCompleto: string;
  prestadorFotoPerfilUrl: string | null;
  categoriaNombre: string;
  comentarioCalificacion: string | null;
  solicitadoEn: string;
}
