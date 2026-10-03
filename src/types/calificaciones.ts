// Espejo de fixit-web/types/calificaciones.ts.

// Fotos cargadas por el cliente en su reseña (03/10, agregado junto con el rediseño del perfil
// público del prestador). "estadoRepost" le sirve al prestador para saber si ya la tiene, si le
// está pidiendo permiso al cliente, o si el cliente ya le dijo que no.
export interface CalificacionFoto {
  id: string;
  url: string;
  estadoRepost: "SinSolicitar" | "Pendiente" | "Aprobado" | "Rechazado";
}

export interface Calificacion {
  id: string;
  clienteNombre: string;
  puntualidad: number;
  calidad: number;
  precio: number;
  comunicacion: number;
  limpieza: number;
  garantia: number;
  promedio: number;
  comentario: string | null;
  creadoEn: string;
  fotos: CalificacionFoto[];
}

export interface CrearCalificacionRequest {
  puntualidad: number;
  calidad: number;
  precio: number;
  comunicacion: number;
  limpieza: number;
  garantia: number;
  comentario?: string;
}

export const CRITERIOS_CALIFICACION: {
  key: keyof Omit<CrearCalificacionRequest, "comentario">;
  label: string;
  descripcion: string;
}[] = [
  { key: "puntualidad", label: "Puntualidad y compromiso", descripcion: "Llegó a horario y cumplió con lo acordado." },
  { key: "calidad", label: "Calidad del trabajo", descripcion: "El trabajo quedó bien hecho y resolvió el problema." },
  { key: "precio", label: "Precio y transparencia", descripcion: "El precio fue justo y no hubo cobros de más sin avisar." },
  { key: "comunicacion", label: "Comunicación y profesionalismo", descripcion: "Se comunicó con claridad y trató con respeto." },
  { key: "limpieza", label: "Limpieza y cuidado", descripcion: "Dejó el lugar limpio y cuidó tus cosas mientras trabajaba." },
  { key: "garantia", label: "Garantía y responsabilidad", descripcion: "Se hizo cargo si algo falló después de terminado el trabajo." },
];
