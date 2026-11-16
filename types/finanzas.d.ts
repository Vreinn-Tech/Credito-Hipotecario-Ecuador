/** Parámetros de un crédito de cuota fija (sistema francés). */
export interface CuotaParams {
  /** Capital financiado, en USD. */
  monto: number;
  /** Tasa nominal anual en %, p. ej. 8.5. Capitalización mensual. */
  tasaNominalAnual: number;
  /** Plazo en años (se redondea a meses enteros). */
  plazoAnios: number;
}

export interface FilaAmortizacion {
  /** Número de cuota, desde 1. */
  n: number;
  cuota: number;
  interes: number;
  capital: number;
  /** Saldo de capital después de pagar la cuota. */
  saldo: number;
}

export interface Amortizacion {
  cuota: number;
  totalIntereses: number;
  totalPagado: number;
  tabla: FilaAmortizacion[];
}

/** Cuota mensual fija (sistema francés). Devuelve 0 si el monto o el plazo no son positivos. */
export function cuotaMensual(p: CuotaParams): number;
/** Tabla de amortización completa, cuota a cuota. */
export function tablaAmortizacion(p: CuotaParams): Amortizacion;
/** Tasa efectiva anual (%) a partir de la nominal anual (%) con capitalización mensual. */
export function tasaEfectiva(tasaNominalAnual: number): number;
/** Monto máximo financiable dado un ingreso mensual y una relación cuota/ingreso (por defecto 0,35). */
export function capacidadDeCredito(ingresoMensual: number, tasaNominalAnual: number, plazoAnios: number, ratio?: number): number;
/** Formatea en dólares con formato es-EC, p. ej. "$65.000". */
export function fmtUSD(v: number, dec?: number): string;
/** Formatea un porcentaje con coma decimal, p. ej. "2,99 %". */
export function fmtPct(v: number, dec?: number): string;
