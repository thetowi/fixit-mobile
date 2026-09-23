// Espejo de fixit-web/types/mercadoPago.ts.

export interface ConexionMercadoPago {
  conectado: boolean;
  trabajosPagados: number;
  trabajosGratisRestantes: number;
}

export interface IniciarConexionMercadoPago {
  initPoint: string;
}
