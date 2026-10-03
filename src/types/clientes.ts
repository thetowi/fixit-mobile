// Espejo de fixit-web/types/clientes.ts (03/10, agregado junto con la pantalla de perfil de
// cliente en mobile) — perfil del cliente visto por un prestador. Ver ClientesController/
// ClientePerfilService en fixit-api para la lógica de qué se expone y por qué (en particular,
// mostrarDireccion).
export interface PerfilCliente {
  id: string;
  nombre: string;
  apellido: string;
  fotoPerfilUrl: string | null;
  verificado: boolean;
  clienteDesde: string;
  telefono: string;
  mostrarDireccion: boolean;
  direccion: string | null;
  direccionVerificada: boolean;
  trabajosCompletadosConEstePrestador: number;
  trabajosCompletadosEnLaPlataforma: number;
  // Calificación del cliente por parte de prestadores, en toda la plataforma. 0/0 si todavía no
  // lo calificó nadie (nunca null, la tarjeta siempre se muestra).
  calificacionComoClientePromedio: number;
  calificacionComoClienteCantidad: number;
  // Inasistencias del cliente — cuenta en toda la plataforma, no solo con este prestador,
  // reportadas por prestadores (no necesariamente resueltas).
  inasistenciasUltimos3Meses: number;
  ultimaInasistenciaFecha: string | null;
  // "Lo que dicen otros prestadores" — vacío si nadie comentó todavía.
  comentariosDeOtrosPrestadores: ComentarioCliente[];
  historialConEstePrestador: OrdenHistorialCliente[];
}

export interface ComentarioCliente {
  prestadorNombreCompleto: string;
  promedio: number;
  comentario: string;
  creadoEn: string;
}

export interface OrdenHistorialCliente {
  ordenId: string;
  fecha: string | null;
  categoriaNombre: string;
  descripcion: string;
  estado: string;
  inasistenciaReportada: boolean;
  // Reseña que el cliente dejó sobre este prestador para esta orden — null si esa orden todavía
  // no fue calificada.
  resenaPromedio: number | null;
  resenaComentario: string | null;
  resenaCreadoEn: string | null;
}
