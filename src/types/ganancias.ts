export type PeriodoGanancias = "semana" | "mes" | "anio";

export interface GananciasDesgloseItem {
  etiqueta: string;
  monto: number;
  esPeriodoActual: boolean;
}

export interface GananciasTrabajo {
  ordenId: string;
  completadoEn: string;
  categoriaNombre: string;
  descripcion: string;
  clienteNombreCompleto: string;
  montoTotal: number;
  comisionPlataforma: number;
  neto: number;
  // "Cobrado" (26/10): modo Directo, el cliente le pagó directo al prestador (no hay Pago en Oficy).
  estado: "Liberado" | "Liquidado" | "Cobrado";
}

export interface GananciasResponse {
  periodo: PeriodoGanancias;
  inicio: string;
  fin: string;

  totalGanado: number;
  totalPendiente: number;
  totalTransferido: number;

  comparacionPorcentaje: number | null;
  totalPeriodoAnterior: number | null;

  trabajosCompletados: number;
  promedioPorTrabajo: number;

  trabajosPagadosTotal: number;
  trabajosGratisRestantes: number;

  desglose: GananciasDesgloseItem[];
  trabajos: GananciasTrabajo[];
}
