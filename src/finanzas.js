/**
 * Utilidades financieras para créditos hipotecarios en Ecuador.
 * Sistema francés (cuota fija), tasa nominal anual con capitalización mensual.
 * Código puro, sin dependencias: funciona en Node, navegadores y Workers.
 */

/**
 * @typedef {Object} CuotaParams
 * @property {number} monto Capital financiado (USD)
 * @property {number} tasaNominalAnual En %, p. ej. 8.5
 * @property {number} plazoAnios
 */

/** Cuota mensual fija (sistema francés). @param {CuotaParams} p */
export function cuotaMensual({ monto, tasaNominalAnual, plazoAnios }) {
  const i = tasaNominalAnual / 100 / 12;
  const n = Math.round(plazoAnios * 12);
  if (n <= 0 || monto <= 0) return 0;
  if (i === 0) return monto / n;
  return (monto * i) / (1 - Math.pow(1 + i, -n));
}

/**
 * Tabla de amortización completa.
 * @param {CuotaParams} p
 * @returns {{cuota:number,totalIntereses:number,totalPagado:number,tabla:Array<{n:number,cuota:number,interes:number,capital:number,saldo:number}>}}
 */
export function tablaAmortizacion(p) {
  const i = p.tasaNominalAnual / 100 / 12;
  const n = Math.round(p.plazoAnios * 12);
  const cuota = cuotaMensual(p);
  let saldo = p.monto;
  let totalIntereses = 0;
  const tabla = [];
  for (let k = 1; k <= n; k++) {
    const interes = saldo * i;
    const capital = cuota - interes;
    saldo = Math.max(0, saldo - capital);
    totalIntereses += interes;
    tabla.push({ n: k, cuota, interes, capital, saldo });
  }
  return { cuota, totalIntereses, totalPagado: cuota * n, tabla };
}

/** Tasa efectiva anual (%) a partir de la nominal con capitalización mensual. */
export function tasaEfectiva(tasaNominalAnual) {
  return (Math.pow(1 + tasaNominalAnual / 100 / 12, 12) - 1) * 100;
}

/** Monto máximo financiable dado un ingreso mensual y una relación cuota/ingreso. */
export function capacidadDeCredito(ingresoMensual, tasaNominalAnual, plazoAnios, ratio = 0.35) {
  const cuotaMax = ingresoMensual * ratio;
  const i = tasaNominalAnual / 100 / 12;
  const n = Math.round(plazoAnios * 12);
  if (i === 0) return cuotaMax * n;
  return (cuotaMax * (1 - Math.pow(1 + i, -n))) / i;
}

export const fmtUSD = (v, dec = 0) =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD', maximumFractionDigits: dec, minimumFractionDigits: dec }).format(v);

export const fmtPct = (v, dec = 2) => `${v.toFixed(dec).replace('.', ',')} %`;
