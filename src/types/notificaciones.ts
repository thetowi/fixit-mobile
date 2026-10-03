// Centro de notificaciones (03/10, a pedido del usuario) — espejo de
// fixit-web/types/notificaciones.ts / FixIt.Application.DTOs.Notificaciones.NotificacionResponse.
export interface Notificacion {
  id: string;
  titulo: string;
  cuerpo: string;
  url: string;
  leida: boolean;
  creadoEn: string;
}
