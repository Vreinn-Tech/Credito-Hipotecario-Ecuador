export type Categoria = 'publico' | 'preferencial' | 'privado' | 'subsidio';
export type Uso = 'vivienda_terminada' | 'construccion' | 'terreno' | 'remodelacion' | 'sustitucion' | 'vis_vip';
export type RelacionLaboral = 'dependiente' | 'independiente' | 'jubilado' | 'migrante';
export type Elegibilidad = 'apto' | 'condicional' | 'no_apto';
export type TipoEntidad = 'publico' | 'banco' | 'cooperativa' | 'mutualista';

/** Tramo de financiamiento según el valor del inmueble. */
export interface Tramo {
  /** Valor máximo del inmueble (USD) al que aplica el tramo. */
  hastaUsd: number;
  /** % máximo de financiamiento en ese tramo. */
  pct: number;
}

/** Ficha de un producto de crédito o subsidio (data/programas.json). */
export interface Programa {
  slug: string;
  nombre: string;
  /** Slug de la entidad en data/entidades.json. */
  entidad: string;
  categoria: Categoria;
  resumen: string;
  descripcion: string;
  paraQuien: string;
  usos: Uso[];
  /** % anual. null en subsidios o cuando no hay tasa publicada. */
  tasaNominal: number | null;
  /** % anual. */
  tasaEfectiva: number | null;
  tasaNota?: string;
  plazoMinAnios: number | null;
  plazoMaxAnios: number | null;
  /** % del avalúo / precio. */
  financiamientoMaxPct: number | null;
  entradaMinPct: number | null;
  montoMinUsd: number | null;
  montoMaxUsd: number | null;
  /** Precio máximo de la vivienda (VIS/VIP y programas con tope). */
  precioViviendaMaxUsd: number | null;
  /** VIP: precio mínimo del segmento. */
  precioViviendaMinUsd?: number;
  /** Tope de ingresos familiares mensuales. */
  ingresoMaxUsd?: number;
  /** % de financiamiento según valor del inmueble; tiene prioridad sobre financiamientoMaxPct. */
  tramos?: Tramo[];
  requiereAfiliacionIess: boolean;
  /** Meses de aportación al IESS. */
  aportacionesMinimas?: number;
  edadMin: number | null;
  /** Edad máxima al finalizar el crédito. */
  edadMax: number | null;
  /** 0.35 = la cuota no debe superar el 35 % del ingreso disponible. */
  ratioCuotaIngreso: number;
  soloPrimeraVivienda: boolean;
  /** Solo vivienda nueva de primer uso. */
  soloViviendaNueva?: boolean;
  requisitos: string[];
  ventajas: string[];
  desventajas: string[];
  pasos?: string[];
  /** Fuente oficial del dato. */
  fuenteUrl: string;
  /** Fecha del dato, AAAA-MM-DD: publicación o vigencia de la fuente o, si no la indica, día de la consulta. */
  fechaDato: string;
  /** false = dato preliminar, tomado de fuentes secundarias o no confirmado con la entidad. */
  verificado: boolean;
}

/** Institución financiera o entidad pública (data/entidades.json). */
export interface Entidad {
  slug: string;
  nombre: string;
  tipo: TipoEntidad;
  descripcion: string;
  sitioUrl?: string;
  simuladorUrl?: string;
  /** "nacional" o lista de slugs de provincia (lista vacía = cobertura no confirmada). */
  coberturaProvincias: string[] | 'nacional';
  fuenteUrl?: string;
  /** AAAA-MM-DD; ausente cuando no se pudo confirmar. */
  fechaDato?: string;
  /** Entidad aliada del programa Tu Casa Miti-Miti. */
  miti?: boolean;
}

/** Perfil del comprador que se evalúa. */
export interface PerfilUsuario {
  /** Precio o avalúo de la vivienda, USD. */
  precioVivienda: number;
  /** Ahorro disponible para la entrada, USD. */
  entradaDisponible: number;
  /** Ingreso neto mensual del hogar, USD. */
  ingresoMensual: number;
  /** Cuotas mensuales de otras deudas, USD. */
  deudasMensuales: number;
  afiliadoIess: boolean;
  /** Meses de aportación al IESS. */
  aportaciones: number;
  edad: number;
  uso: Uso;
  primeraVivienda: boolean;
  relacionLaboral: RelacionLaboral;
  /** Plazo deseado en años. */
  plazoDeseado: number;
  /** true = nueva, false = usada, sin definir = no se sabe (los productos solo para vivienda nueva quedan «condicional»). */
  viviendaNueva?: boolean;
}

/** Resultado de evaluar un producto contra un perfil. */
export interface ResultadoPrograma {
  programa: Programa;
  elegibilidad: Elegibilidad;
  /** 0–100; 0 si no es apto. */
  score: number;
  /** Bloqueos y condiciones detectados, en español. */
  razones: string[];
  /** Monto que el producto financiaría, USD. */
  montoFinanciable: number;
  /** Cuota mensual estimada (solo capital e interés), USD. */
  cuotaEstimada: number;
  /** Plazo aplicado en años (ajustado por el máximo y el mínimo del producto y por la edad). */
  plazo: number;
  /** Entrada mínima para ese precio, USD: precio − min(precio × % financiable, montoMaxUsd). */
  entradaRequerida: number;
  /** Crédito máximo que soporta el ingreso disponible con la tasa y plazo del producto, USD. */
  capacidadMaxima: number;
}

export const USOS: readonly Uso[];
export const RELACIONES_LABORALES: readonly RelacionLaboral[];

/** Evalúa un producto contra un perfil completo. */
export function evaluarPrograma(p: Programa, u: PerfilUsuario): ResultadoPrograma;
/** Evalúa todos los productos (excluye categoría "subsidio") y los ordena por puntaje descendente y cuota ascendente. */
export function evaluarTodos(programas: Programa[], u: PerfilUsuario): ResultadoPrograma[];
/**
 * Valida y completa un perfil parcial. Obligatorios: precioVivienda e ingresoMensual.
 * Lanza Error con mensaje en español si un campo es inválido.
 */
export function normalizarPerfil(parcial?: Partial<PerfilUsuario>): PerfilUsuario;
