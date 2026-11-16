// ARCHIVO GENERADO por scripts/build-docs.mjs a partir de src/evaluacion.js. No lo edites aquí: cambia el original y vuelve a ejecutar el script.
/**
 * Motor de elegibilidad: dado un perfil de comprador y la ficha de un producto (data/programas.json),
 * indica si califica (apto / condicional / no_apto), por qué, y estima monto, cuota y entrada.
 * Código puro, sin dependencias. Los tipos están en ../types/index.d.ts.
 */
import { cuotaMensual, capacidadDeCredito } from './finanzas.js';

export const USOS = ['vivienda_terminada', 'construccion', 'terreno', 'remodelacion', 'sustitucion', 'vis_vip'];
export const RELACIONES_LABORALES = ['dependiente', 'independiente', 'jubilado', 'migrante'];

const usd = (v) => Math.round(v).toLocaleString('es-EC');

/**
 * Evalúa un producto contra un perfil.
 * @param {import('../types/index.d.ts').Programa} p
 * @param {import('../types/index.d.ts').PerfilUsuario} u
 * @returns {import('../types/index.d.ts').ResultadoPrograma}
 */
export function evaluarPrograma(p, u) {
  const razones = [];
  let nivel = 'apto';
  const bloquea = (msg) => { razones.push(msg); nivel = 'no_apto'; };
  const condiciona = (msg) => { razones.push(msg); if (nivel === 'apto') nivel = 'condicional'; };

  if (!p.usos.includes(u.uso) && !(u.uso === 'vivienda_terminada' && p.usos.includes('vis_vip'))) {
    bloquea('Este producto no financia el destino que buscas.');
  }
  if (p.requiereAfiliacionIess && !u.afiliadoIess) bloquea('Requiere afiliación al IESS.');
  if (p.requiereAfiliacionIess && p.aportacionesMinimas && u.aportaciones < p.aportacionesMinimas) {
    bloquea(`Requiere al menos ${p.aportacionesMinimas} aportaciones al IESS (tienes ${u.aportaciones}).`);
  }
  if (p.soloPrimeraVivienda && !u.primeraVivienda) bloquea('Solo aplica para primera vivienda.');
  if (p.soloViviendaNueva && u.viviendaNueva === false) bloquea('Solo financia vivienda nueva de primer uso.');
  if (p.precioViviendaMaxUsd && u.precioVivienda > p.precioViviendaMaxUsd) {
    bloquea(`El precio de la vivienda supera el tope del programa (${usd(p.precioViviendaMaxUsd)} USD).`);
  }
  if (p.precioViviendaMinUsd && u.precioVivienda < p.precioViviendaMinUsd) {
    bloquea(`Este segmento es para viviendas desde ${usd(p.precioViviendaMinUsd)} USD; revisa la opción VIS.`);
  }
  if (p.ingresoMaxUsd && u.ingresoMensual > p.ingresoMaxUsd) {
    bloquea(`Tus ingresos familiares superan el tope del programa (${usd(p.ingresoMaxUsd)} USD/mes).`);
  }
  if (p.edadMin && u.edad < p.edadMin) bloquea(`Edad mínima: ${p.edadMin} años.`);

  const plazoMax = p.plazoMaxAnios ?? 25;
  let plazo = Math.min(u.plazoDeseado, plazoMax);
  if (p.edadMax) {
    const plazoPorEdad = p.edadMax - u.edad;
    if (plazoPorEdad < (p.plazoMinAnios ?? 3)) bloquea(`Por edad, el plazo disponible sería menor al mínimo (edad máxima al terminar: ${p.edadMax}).`);
    else if (plazoPorEdad < plazo) { plazo = plazoPorEdad; condiciona(`Por tu edad el plazo máximo sería de ${plazo} años.`); }
  }

  const tramo = p.tramos?.find((t) => u.precioVivienda <= t.hastaUsd);
  const finPct = (tramo?.pct ?? p.financiamientoMaxPct ?? 80) / 100;
  const montoMaxPorValor = u.precioVivienda * finPct;
  const entradaRequerida = Math.max(0, u.precioVivienda - montoMaxPorValor);
  const montoNecesario = Math.max(0, u.precioVivienda - u.entradaDisponible);
  if (u.entradaDisponible < entradaRequerida) {
    condiciona(`Necesitas una entrada mínima del ${Math.round((1 - finPct) * 100)} % (≈ ${usd(entradaRequerida)} USD).`);
  }
  let montoFinanciable = Math.min(montoNecesario, montoMaxPorValor);
  if (p.montoMaxUsd && montoFinanciable > p.montoMaxUsd) {
    montoFinanciable = p.montoMaxUsd;
    condiciona(`El monto máximo del producto es ${p.montoMaxUsd.toLocaleString('es-EC')} USD; deberías cubrir la diferencia.`);
  }
  if (p.montoMinUsd && montoNecesario < p.montoMinUsd) condiciona(`El monto mínimo del producto es ${p.montoMinUsd.toLocaleString('es-EC')} USD.`);

  const tasa = p.tasaNominal ?? 10;
  const cuotaEstimada = cuotaMensual({ monto: montoFinanciable, tasaNominalAnual: tasa, plazoAnios: plazo });
  const ingresoDisponible = Math.max(0, u.ingresoMensual - u.deudasMensuales);
  const capacidadMaxima = capacidadDeCredito(ingresoDisponible, tasa, plazo, p.ratioCuotaIngreso);
  const ratio = ingresoDisponible > 0 ? cuotaEstimada / ingresoDisponible : 1;
  if (ratio > p.ratioCuotaIngreso) {
    const deficit = ratio / p.ratioCuotaIngreso;
    const msg = `La cuota (≈ ${usd(cuotaEstimada)} USD) superaría el ${Math.round(p.ratioCuotaIngreso * 100)} % de tu ingreso disponible.`;
    if (deficit > 1.4) bloquea(msg); else condiciona(msg + ' Podrías aumentar la entrada o el plazo.');
  }
  if (u.relacionLaboral === 'independiente') condiciona('Como independiente deberás justificar ingresos (RUC, declaraciones, movimientos bancarios).');
  if (u.relacionLaboral === 'migrante' && p.categoria === 'publico') condiciona('Verifica el programa para ecuatorianos en el exterior de esta entidad.');

  // Puntaje: holgura frente al ratio cuota/ingreso, costo de la tasa y número de observaciones.
  let score = nivel === 'no_apto' ? 0 : 100;
  if (nivel !== 'no_apto') {
    score -= Math.min(40, Math.max(0, (ratio / p.ratioCuotaIngreso - 0.6) * 60));
    score -= Math.min(30, Math.max(0, (tasa - 4.5) * 4));
    score -= Math.min(20, razones.length * 6);
    if (!p.verificado) score -= 2;
  }
  return {
    programa: p, elegibilidad: nivel, score: Math.round(Math.max(0, score)), razones,
    montoFinanciable, cuotaEstimada, plazo, entradaRequerida, capacidadMaxima,
  };
}

/**
 * Evalúa todos los productos de crédito (excluye bonos/subsidios) y los ordena de mejor a peor.
 * @param {import('../types/index.d.ts').Programa[]} programas
 * @param {import('../types/index.d.ts').PerfilUsuario} u
 */
export function evaluarTodos(programas, u) {
  return programas
    .filter((p) => p.categoria !== 'subsidio')
    .map((p) => evaluarPrograma(p, u))
    .sort((a, b) => b.score - a.score || a.cuotaEstimada - b.cuotaEstimada);
}

/**
 * Valida y completa un perfil parcial (útil para CLI, API y MCP). Lanza Error con mensaje claro si algo no cuadra.
 * Obligatorios: precioVivienda e ingresoMensual. El resto toma valores por defecto conservadores.
 * @param {Partial<import('../types/index.d.ts').PerfilUsuario>} e
 * @returns {import('../types/index.d.ts').PerfilUsuario}
 */
export function normalizarPerfil(e = {}) {
  const num = (campo, def, { min = 0, max = Infinity } = {}) => {
    const v = e[campo] ?? def;
    if (v === undefined) throw new Error(`Falta el campo obligatorio "${campo}".`);
    const n = Number(v);
    if (!Number.isFinite(n) || n < min || n > max) throw new Error(`"${campo}" debe ser un número entre ${min} y ${max === Infinity ? '∞' : max} (recibido: ${JSON.stringify(v)}).`);
    return n;
  };
  const bool = (campo, def) => {
    const v = e[campo] ?? def;
    if (typeof v !== 'boolean') throw new Error(`"${campo}" debe ser true o false.`);
    return v;
  };
  const uso = e.uso ?? 'vivienda_terminada';
  if (!USOS.includes(uso)) throw new Error(`"uso" debe ser uno de: ${USOS.join(', ')}.`);
  const relacionLaboral = e.relacionLaboral ?? 'dependiente';
  if (!RELACIONES_LABORALES.includes(relacionLaboral)) throw new Error(`"relacionLaboral" debe ser uno de: ${RELACIONES_LABORALES.join(', ')}.`);
  const afiliadoIess = bool('afiliadoIess', false);
  const perfil = {
    precioVivienda: num('precioVivienda', undefined, { min: 1 }),
    entradaDisponible: num('entradaDisponible', 0),
    ingresoMensual: num('ingresoMensual', undefined),
    deudasMensuales: num('deudasMensuales', 0),
    afiliadoIess,
    aportaciones: num('aportaciones', 0),
    edad: num('edad', 35, { min: 18, max: 100 }),
    uso,
    primeraVivienda: bool('primeraVivienda', true),
    relacionLaboral,
    plazoDeseado: num('plazoDeseado', 20, { min: 1, max: 40 }),
  };
  if (e.viviendaNueva !== undefined && e.viviendaNueva !== null) perfil.viviendaNueva = bool('viviendaNueva');
  return perfil;
}
