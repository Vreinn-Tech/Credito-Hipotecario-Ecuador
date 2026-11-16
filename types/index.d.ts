import type { Programa, Entidad, PerfilUsuario, ResultadoPrograma } from './evaluacion.js';

export * from './finanzas.js';
export * from './evaluacion.js';

/** Los productos de data/programas.json (solo Node). */
export const programas: Programa[];
/** Las entidades de data/entidades.json (solo Node). */
export const entidades: Entidad[];
/** Busca un producto por slug, p. ej. "biess-credicasa". */
export function buscarPrograma(slug: string): Programa | undefined;
/** Busca una entidad por slug, p. ej. "biess". */
export function buscarEntidad(slug: string): Entidad | undefined;
/** normalizarPerfil + evaluarTodos sobre los productos del paquete. */
export function evaluarPerfil(perfilParcial: Partial<PerfilUsuario>): ResultadoPrograma[];
