// Espejo de fixit-web/types/calificaciones.ts.

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
