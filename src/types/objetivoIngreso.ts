// Espejo de fixit-web/types/objetivoIngreso.ts — "Sueldo pretendido" (29/09), ver
// claude/aviso-pago-y-sueldo-pretendido-28-09.md.
export interface ObjetivoIngreso {
  tieneObjetivo: boolean;
  montoMensual: number | null;
  ticketPromedio: number;
  ticketEsManual: boolean;
  ticketDisponible: boolean;
  gananciaDelMes: number;
  trabajosCompletadosDelMes: number;
  porcentajeProgreso: number;
  trabajosNecesariosTotal: number | null;
  trabajosFaltantes: number | null;
  cumplido: boolean;
}

export interface EstablecerObjetivoIngresoRequest {
  montoMensual: number;
  ticketPromedioManual?: number | null;
}
