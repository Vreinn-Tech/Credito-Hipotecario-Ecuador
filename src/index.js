/**
 * credito-hipotecario-ecuador — punto de entrada para Node.
 * Reexporta las utilidades financieras, el motor de elegibilidad y los datos.
 * Para entornos sin sistema de archivos usa los subpaths puros:
 *   "credito-hipotecario-ecuador/evaluacion" y "credito-hipotecario-ecuador/finanzas".
 */
import { evaluarTodos, normalizarPerfil } from './evaluacion.js';
import { programas } from './datos.js';

export * from './finanzas.js';
export * from './evaluacion.js';
export * from './datos.js';

/**
 * Atajo: valida y completa un perfil parcial y lo evalúa contra todos los productos del paquete.
 * Solo son obligatorios precioVivienda e ingresoMensual.
 * @param {Partial<import('../types/index.d.ts').PerfilUsuario>} perfilParcial
 * @returns {import('../types/index.d.ts').ResultadoPrograma[]}
 */
export function evaluarPerfil(perfilParcial) {
  return evaluarTodos(programas, normalizarPerfil(perfilParcial));
}
