// Nuevo sistema de cobros (26/10). Espejo de fixit-web/types/cobros.ts (solo lo que usa la app).

export type ModoCobro = "Directo" | "Retenido";

export interface TarifaVigente {
  montoPorTrabajo: number;
  topeMensual: number;
  vigenteDesde: string;
}

export interface ConfigPublica {
  modoCobro: ModoCobro;
  tarifa: TarifaVigente | null;
}

export type EstadoResumen = "Pendiente" | "Pagado" | "Vencido" | "Bonificado" | "SinCargo";

export interface ResumenMensual {
  id: string;
  periodo: string; // "2026-11"
  cantidadTrabajos: number;
  trabajosBonificados: number;
  subtotal: number;
  tope: number;
  total: number;
  ahorro: number;
  estado: EstadoResumen;
  venceEn: string;
  pagadoEn: string | null;
  medioPago: string | null;
}

export interface MiPlan {
  modoCobro: ModoCobro;
  tarifa: TarifaVigente | null;
  esFundador: boolean;
  fundadorHasta: string | null;
  ahorroFundadorTotal: number;
  periodoActual: string;
  trabajosMesActual: number;
  cargoMesActual: number;
  topeAlcanzado: boolean;
  suspendido: boolean;
  deudaTotal: number;
  resumenes: ResumenMensual[];
}

export const ESTADO_RESUMEN_LABEL: Record<EstadoResumen, string> = {
  Pendiente: "Pendiente",
  Pagado: "Pagado",
  Vencido: "Vencido",
  Bonificado: "Bonificado",
  SinCargo: "Sin cargo",
};
