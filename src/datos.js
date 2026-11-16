/**
 * Acceso a los datos del paquete (solo Node): lee data/programas.json y data/entidades.json del disco.
 * En navegadores o Workers importa los JSON directamente ("credito-hipotecario-ecuador/data/programas.json")
 * y usa las funciones puras de ./evaluacion.js y ./finanzas.js.
 */
import { readFileSync } from 'node:fs';

const leer = (archivo) => JSON.parse(readFileSync(new URL(`../data/${archivo}`, import.meta.url), 'utf8'));

/** @type {import('../types/index.d.ts').Programa[]} */
export const programas = leer('programas.json');

/** @type {import('../types/index.d.ts').Entidad[]} */
export const entidades = leer('entidades.json');

/**
 * Busca un producto por su slug (p. ej. "biess-credicasa").
 * @param {string} slug
 * @returns {import('../types/index.d.ts').Programa | undefined}
 */
export function buscarPrograma(slug) {
  return programas.find((p) => p.slug === slug);
}

/**
 * Busca una entidad por su slug (p. ej. "biess").
 * @param {string} slug
 * @returns {import('../types/index.d.ts').Entidad | undefined}
 */
export function buscarEntidad(slug) {
  return entidades.find((e) => e.slug === slug);
}
