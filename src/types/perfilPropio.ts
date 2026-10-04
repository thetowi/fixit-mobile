// Espejo de fixit-web/types/perfilPropio.ts.

export interface PerfilPropio {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  telefono: string;
  rol: string;
  fotoPerfilUrl: string | null;
  verificado: boolean;
  direccion: string | null;
  direccionVerificada: boolean;
  latitud: number | null;
  longitud: number | null;
  radioAlcanceKm: number | null;
  // Separado en 2 campos el 04/10 (antes "cbuOAlias" único) — para más seguridad al transferir.
  cbu: string | null;
  alias: string | null;
  titularCuentaCobro: string | null;
  // 0 = Domingo ... 6 = Sábado.
  diaPreferidoDeCobro: number | null;
}

export interface ActualizarPerfilRequest {
  nombre: string;
  apellido: string;
  telefono: string;
  direccion?: string;
  // Solo se mandan cuando el usuario eligió una sugerencia del autocompletado de direcciones
  direccionLat?: number;
  direccionLon?: number;
}

export interface ActualizarDatosCobroRequest {
  cbu: string;
  alias: string;
  titularCuentaCobro: string;
  diaPreferidoDeCobro?: number | null;
}
