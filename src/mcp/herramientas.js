/**
 * Herramientas del servidor MCP: definición (nombre, descripción, esquemas) y ejecución.
 * Código puro (sin node:*, sin fetch): los datos se inyectan con crearHerramientas({ programas, entidades }).
 */
import { tablaAmortizacion, tasaEfectiva, capacidadDeCredito } from '../finanzas.js';
import { evaluarTodos, normalizarPerfil, USOS, RELACIONES_LABORALES } from '../evaluacion.js';

export const SITIO = 'https://creditohipotecarioecuador.com';
export const URL_EVALUACION = `${SITIO}/evaluacion/`;
export const AVISO =
  'Datos referenciales con fecha (campo fechaDato de cada producto); no es una oferta de crédito ni asesoría financiera. ' +
  'Verifica tasas, requisitos y condiciones directamente con la entidad antes de decidir.';
export const NOTA = `Nota: ${AVISO} Fuente: creditohipotecarioecuador.com — evaluación completa y gratuita en ${URL_EVALUACION}`;

const FUENTE = { nombre: 'creditohipotecarioecuador.com', url: `${SITIO}/`, evaluacionUrl: URL_EVALUACION };
const CATEGORIAS = ['publico', 'preferencial', 'privado', 'subsidio'];
const TIPOS_ENTIDAD = ['publico', 'banco', 'cooperativa', 'mutualista'];
const PROVINCIAS = [
  'azuay', 'bolivar', 'canar', 'carchi', 'chimborazo', 'cotopaxi', 'el-oro', 'esmeraldas', 'galapagos', 'guayas', 'imbabura', 'loja',
  'los-rios', 'manabi', 'morona-santiago', 'napo', 'orellana', 'pastaza', 'pichincha', 'santa-elena', 'santo-domingo-de-los-tsachilas',
  'sucumbios', 'tungurahua', 'zamora-chinchipe',
];
const ETIQUETA_USO = {
  vivienda_terminada: 'compra de vivienda terminada',
  construccion: 'construcción en terreno propio',
  terreno: 'compra de terreno',
  remodelacion: 'ampliación o remodelación',
  sustitucion: 'sustitución de hipoteca',
  vis_vip: 'vivienda de interés social o público (VIS/VIP)',
};
const ETIQUETA_CATEGORIA = {
  publico: 'crédito público (BIESS)',
  preferencial: 'tasa preferencial VIS/VIP',
  privado: 'banca, cooperativas y mutualistas',
  subsidio: 'bono o subsidio del Estado',
};
const ETIQUETA_ELEGIBILIDAD = { apto: 'apto', condicional: 'condicional', no_apto: 'no apto' };

/** Error de validación o de negocio: se devuelve al modelo como resultado con isError: true (no como error de protocolo). */
export class ErrorDeHerramienta extends Error {}

// ───────────────────────── utilidades ─────────────────────────

const r2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

/** 1234567.5 → "1.234.567,50" (formato usado en Ecuador), sin depender de Intl. */
function miles(v, dec = 0) {
  const [ent, frac] = Math.abs(v).toFixed(dec).split('.');
  const conPuntos = ent.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${v < 0 ? '-' : ''}${conPuntos}${frac ? `,${frac}` : ''}`;
}
const usd = (v, dec = 0) => (v === null || v === undefined ? 'sin dato' : `${miles(v, dec)} USD`);
const pct = (v, dec = 2) => (v === null || v === undefined ? 'sin dato' : `${v.toFixed(dec).replace('.', ',')} %`);
const siNo = (v) => (v ? 'sí' : 'no');

/** minúsculas, sin tildes ni signos: para buscar y para aceptar "Pichincha" o "El Oro" como slug. */
const plano = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const aSlug = (s) => plano(s).replace(/ /g, '-');

/** Lector de argumentos con validación, valores por defecto y mensajes pensados para que un LLM corrija la llamada. */
function lector(args, esquema) {
  const validos = Object.keys(esquema.properties);
  const sobran = Object.keys(args).filter((k) => !validos.includes(k));
  if (sobran.length) {
    throw new ErrorDeHerramienta(`Parámetro(s) no reconocido(s): ${sobran.join(', ')}. Parámetros válidos: ${validos.join(', ')}.`);
  }
  const crudo = (campo, def) => {
    const v = args[campo];
    if (v !== undefined && v !== null && v !== '') return v;
    if (def === undefined) throw new ErrorDeHerramienta(`Falta el parámetro obligatorio "${campo}".`);
    return def;
  };
  return {
    tiene: (campo) => args[campo] !== undefined && args[campo] !== null && args[campo] !== '',
    num(campo, { min = -Infinity, max = Infinity, def, entero = false, exclusivoMin = false } = {}) {
      const v = crudo(campo, def);
      const n = typeof v === 'string' ? Number(v.trim().replace(',', '.')) : v;
      const fuera = typeof n !== 'number' || !Number.isFinite(n) || n > max || (exclusivoMin ? n <= min : n < min) || (entero && !Number.isInteger(n));
      if (fuera) {
        const rango = `${exclusivoMin ? 'mayor que' : 'desde'} ${min === -Infinity ? '-∞' : min}${max === Infinity ? '' : ` hasta ${max}`}`;
        throw new ErrorDeHerramienta(`"${campo}" debe ser un número${entero ? ' entero' : ''} ${rango} (recibido: ${JSON.stringify(v)}).`);
      }
      return n;
    },
    bool(campo, def) {
      const v = crudo(campo, def);
      if (v === true || v === 'true') return true;
      if (v === false || v === 'false') return false;
      throw new ErrorDeHerramienta(`"${campo}" debe ser true o false (recibido: ${JSON.stringify(v)}).`);
    },
    opcion(campo, valores, def) {
      const v = crudo(campo, def);
      if (v === null) return null;
      if (!valores.includes(v)) throw new ErrorDeHerramienta(`"${campo}" debe ser uno de: ${valores.join(', ')} (recibido: ${JSON.stringify(v)}).`);
      return v;
    },
    texto(campo, def, max = 300) {
      const v = crudo(campo, def);
      if (v === null) return null;
      if (typeof v !== 'string' || !v.trim()) throw new ErrorDeHerramienta(`"${campo}" debe ser un texto no vacío.`);
      if (v.length > max) throw new ErrorDeHerramienta(`"${campo}" es demasiado largo (máximo ${max} caracteres).`);
      return v.trim();
    },
  };
}

// ───────────────────────── esquemas reutilizables ─────────────────────────

const esquemaFuente = {
  type: 'object',
  description: 'Origen de los datos y enlace a la evaluación completa.',
  properties: { nombre: { type: 'string' }, url: { type: 'string' }, evaluacionUrl: { type: 'string' } },
  required: ['nombre', 'url', 'evaluacionUrl'],
};
const pie = { aviso: { type: 'string', description: 'Aviso legal: datos referenciales, no es oferta de crédito ni asesoría.' }, fuente: esquemaFuente };
const nulo = (type, description) => ({ type: [type, 'null'], description });

const ANOTACIONES = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

// ───────────────────────── fábrica ─────────────────────────

/**
 * @param {{programas: any[], entidades: any[]}} datos
 * @returns {{lista: Array<object>, ejecutar: (nombre: string, args: object) => {texto: string, datos: any, crudo?: boolean}, existe: (nombre: string) => boolean}}
 */
export function crearHerramientas({ programas, entidades }) {
  if (!Array.isArray(programas) || !Array.isArray(entidades)) {
    throw new TypeError('crearHerramientas necesita { programas, entidades } (los arreglos de data/programas.json y data/entidades.json).');
  }
  const entidadPorSlug = new Map(entidades.map((e) => [e.slug, e]));
  const programaPorSlug = new Map(programas.map((p) => [p.slug, p]));
  const nombreEntidad = (slug) => entidadPorSlug.get(slug)?.nombre ?? slug;
  const urlPrograma = (slug) => `${SITIO}/programas/${slug}/`;

  const buscarPrograma = (slug) => {
    const p = programaPorSlug.get(slug) ?? programaPorSlug.get(aSlug(slug));
    if (!p) {
      throw new ErrorDeHerramienta(
        `No existe un producto con slug "${slug}". Slugs válidos: ${programas.map((x) => x.slug).join(', ')}. Usa listar_programas para ver nombres y condiciones.`,
      );
    }
    return p;
  };

  const resumenPrograma = (p) => ({
    slug: p.slug,
    nombre: p.nombre,
    entidad: p.entidad,
    entidadNombre: nombreEntidad(p.entidad),
    categoria: p.categoria,
    usos: p.usos,
    tasaNominal: p.tasaNominal ?? null,
    tasaEfectiva: p.tasaEfectiva ?? null,
    plazoMinAnios: p.plazoMinAnios ?? null,
    plazoMaxAnios: p.plazoMaxAnios ?? null,
    financiamientoMaxPct: p.financiamientoMaxPct ?? null,
    entradaMinPct: p.entradaMinPct ?? null,
    montoMinUsd: p.montoMinUsd ?? null,
    montoMaxUsd: p.montoMaxUsd ?? null,
    precioViviendaMinUsd: p.precioViviendaMinUsd ?? null,
    precioViviendaMaxUsd: p.precioViviendaMaxUsd ?? null,
    ingresoMaxUsd: p.ingresoMaxUsd ?? null,
    requiereAfiliacionIess: p.requiereAfiliacionIess,
    aportacionesMinimas: p.aportacionesMinimas ?? null,
    soloPrimeraVivienda: p.soloPrimeraVivienda,
    soloViviendaNueva: p.soloViviendaNueva ?? false,
    fechaDato: p.fechaDato,
    verificado: p.verificado,
    url: urlPrograma(p.slug),
  });

  const lineaCondiciones = (p) => {
    const partes = [
      `tasa nominal ${pct(p.tasaNominal)}${p.tasaEfectiva ? ` (efectiva ${pct(p.tasaEfectiva)})` : ''}`,
      p.plazoMaxAnios ? `plazo ${p.plazoMinAnios ? `${p.plazoMinAnios}–` : 'hasta '}${p.plazoMaxAnios} años` : null,
      p.financiamientoMaxPct !== null && p.financiamientoMaxPct !== undefined ? `financia hasta ${p.financiamientoMaxPct} %` : null,
      p.montoMaxUsd ? `monto máx. ${usd(p.montoMaxUsd)}` : null,
      p.precioViviendaMaxUsd ? `vivienda hasta ${usd(p.precioViviendaMaxUsd)}` : null,
      p.precioViviendaMinUsd ? `vivienda desde ${usd(p.precioViviendaMinUsd)}` : null,
      p.ingresoMaxUsd ? `ingresos familiares hasta ${usd(p.ingresoMaxUsd)}/mes` : null,
      p.requiereAfiliacionIess ? `requiere IESS${p.aportacionesMinimas ? ` (${p.aportacionesMinimas} aportaciones)` : ''}` : null,
      p.soloPrimeraVivienda ? 'solo primera vivienda' : null,
      p.soloViviendaNueva ? 'solo vivienda nueva' : null,
    ];
    return partes.filter(Boolean).join(' · ');
  };

  const textoFicha = (p) => {
    const lista = (titulo, items) => (items?.length ? `\n${titulo}:\n${items.map((x) => `- ${x}`).join('\n')}` : '');
    const tramos = p.tramos?.length
      ? `\nFinanciamiento según el valor del inmueble:\n${p.tramos.map((t) => `- hasta ${usd(t.hastaUsd)}: ${t.pct} %`).join('\n')}`
      : '';
    return [
      `${p.nombre} — ${nombreEntidad(p.entidad)} (${ETIQUETA_CATEGORIA[p.categoria] ?? p.categoria})`,
      p.resumen,
      '',
      p.descripcion,
      '',
      `Para quién: ${p.paraQuien}`,
      `Financia: ${p.usos.map((u) => ETIQUETA_USO[u] ?? u).join('; ')}.`,
      `Condiciones: ${lineaCondiciones(p)}.`,
      p.tasaNota ? `Sobre la tasa: ${p.tasaNota}` : null,
      `Relación cuota/ingreso máxima: ${Math.round(p.ratioCuotaIngreso * 100)} %.` +
        (p.edadMin || p.edadMax ? ` Edad: ${p.edadMin ? `desde ${p.edadMin}` : ''}${p.edadMin && p.edadMax ? ', ' : ''}${p.edadMax ? `hasta ${p.edadMax} años al terminar de pagar` : ''}.` : ''),
      tramos || null,
      lista('Requisitos', p.requisitos) || null,
      lista('Ventajas', p.ventajas) || null,
      lista('Desventajas', p.desventajas) || null,
      lista('Pasos', p.pasos) || null,
      '',
      `Dato del ${p.fechaDato} (${p.verificado ? 'verificado con la fuente oficial' : 'preliminar, por verificar'}).`,
      `Fuente oficial: ${p.fuenteUrl}`,
      `Ficha y simulador: ${urlPrograma(p.slug)}`,
    ].filter((x) => x !== null).join('\n');
  };

  const cobertura = (e) => (e.coberturaProvincias === 'nacional' ? 'nacional' : e.coberturaProvincias ?? []);
  const textoCobertura = (c) => (c === 'nacional' ? 'nacional' : c.length ? c.join(', ') : 'sin provincias registradas');
  /** URL citable de una entidad: su sitio oficial; si no tiene (p. ej. entidad en liquidación), la fuente del dato o el portal. */
  const urlEntidad = (e) => e.sitioUrl ?? e.fuenteUrl ?? `${SITIO}/`;
  const resumenEntidad = (e) => ({
    slug: e.slug,
    nombre: e.nombre,
    tipo: e.tipo,
    descripcion: e.descripcion,
    sitioUrl: e.sitioUrl ?? null,
    simuladorUrl: e.simuladorUrl ?? null,
    cobertura: cobertura(e),
    aliadaMitiMiti: Boolean(e.miti),
    programas: programas.filter((p) => p.entidad === e.slug).map((p) => p.slug),
  });
  const textoEntidad = (e) => {
    const r = resumenEntidad(e);
    return [
      `${e.nombre} (${e.tipo})`,
      e.descripcion,
      `Cobertura: ${textoCobertura(r.cobertura)}.`,
      e.sitioUrl ? `Sitio oficial: ${e.sitioUrl}` : null,
      e.fuenteUrl ? `Fuente del dato${e.fechaDato ? ` (${e.fechaDato})` : ''}: ${e.fuenteUrl}` : null,
      e.simuladorUrl ? `Simulador oficial: ${e.simuladorUrl}` : null,
      e.miti ? 'Entidad aliada del programa Tu Casa Miti-Miti.' : null,
      r.programas.length ? `Productos registrados: ${r.programas.join(', ')} (usa detalle_programa con el slug).` : 'Sin productos hipotecarios registrados en la base.',
    ].filter(Boolean).join('\n');
  };

  // ───────── evaluar_perfil ─────────
  const evaluarPerfil = {
    name: 'evaluar_perfil',
    title: 'Evaluar perfil para crédito de vivienda (Ecuador)',
    description:
      'Evalúa a qué créditos hipotecarios de Ecuador califica una persona (BIESS, tasa preferencial VIS/VIP "Miti-Miti", bancos, cooperativas y mutualistas) ' +
      'según el precio de la vivienda, sus ingresos, entrada, deudas, afiliación al IESS y edad. Devuelve los productos ordenados de mejor a peor con ' +
      'elegibilidad (apto, condicional o no_apto), puntaje, motivos, monto financiable, cuota mensual estimada, plazo y entrada requerida. ' +
      'Úsala cuando pregunten "¿a qué crédito califico?", "¿me alcanza para una casa de X?" o quieran comparar opciones para su caso. ' +
      'Montos en USD. Si faltan datos, pregunta al menos precio de la vivienda e ingreso mensual; el resto tiene valores por defecto conservadores.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['precioVivienda', 'ingresoMensual'],
      properties: {
        precioVivienda: { type: 'number', minimum: 1, description: 'Precio o avalúo de la vivienda (o costo de la obra/terreno) en USD.' },
        ingresoMensual: { type: 'number', minimum: 0, description: 'Ingreso mensual neto del hogar en USD (suma de quienes solicitan el crédito).' },
        entradaDisponible: { type: 'number', minimum: 0, default: 0, description: 'Ahorro disponible para la entrada, en USD. Por defecto 0.' },
        deudasMensuales: { type: 'number', minimum: 0, default: 0, description: 'Suma de cuotas mensuales de otras deudas (tarjetas, auto, préstamos), en USD. Por defecto 0.' },
        afiliadoIess: { type: 'boolean', default: false, description: 'true si es afiliado o jubilado del IESS (requisito de los créditos del BIESS). Por defecto false.' },
        aportaciones: { type: 'number', minimum: 0, default: 0, description: 'Número de aportaciones mensuales al IESS acumuladas. Por defecto 0.' },
        edad: { type: 'number', minimum: 18, maximum: 100, default: 35, description: 'Edad en años cumplidos. Por defecto 35.' },
        uso: { type: 'string', enum: USOS, default: 'vivienda_terminada', description: 'Destino del crédito: vivienda_terminada (comprar casa o departamento), construccion (en terreno propio), terreno, remodelacion (ampliar o remodelar), sustitucion (trasladar una hipoteca) o vis_vip (vivienda de interés social o público).' },
        primeraVivienda: { type: 'boolean', default: true, description: 'true si sería su primera y única vivienda. Por defecto true.' },
        relacionLaboral: { type: 'string', enum: RELACIONES_LABORALES, default: 'dependiente', description: 'Situación laboral: dependiente (empleado), independiente, jubilado o migrante (ecuatoriano en el exterior). Por defecto dependiente.' },
        plazoDeseado: { type: 'number', minimum: 1, maximum: 40, default: 20, description: 'Plazo deseado en años (cada producto lo limita a su máximo). Por defecto 20.' },
        viviendaNueva: { type: 'boolean', description: 'true si la vivienda es nueva de primer uso; false si es usada. Omítelo si no se sabe: los productos que solo financian vivienda nueva quedarán «condicional» hasta confirmarlo, así que pregúntalo si la persona compra vivienda terminada.' },
        incluirNoAptos: { type: 'boolean', default: false, description: 'true para incluir también los productos a los que NO califica, con el motivo. Por defecto false.' },
        limite: { type: 'integer', minimum: 1, maximum: 50, default: 8, description: 'Máximo de productos a devolver. Por defecto 8.' },
      },
    },
    outputSchema: {
      type: 'object',
      required: ['perfil', 'conteo', 'resultados', 'aviso', 'fuente'],
      properties: {
        perfil: { type: 'object', description: 'Perfil evaluado, con los valores por defecto aplicados.' },
        conteo: {
          type: 'object',
          description: 'Cuántos productos de crédito se evaluaron y cómo quedaron (los bonos y subsidios no se evalúan).',
          properties: { evaluados: { type: 'integer' }, aptos: { type: 'integer' }, condicionales: { type: 'integer' }, noAptos: { type: 'integer' }, devueltos: { type: 'integer' } },
          required: ['evaluados', 'aptos', 'condicionales', 'noAptos', 'devueltos'],
        },
        resultados: {
          type: 'array',
          description: 'Productos ordenados de mejor a peor puntaje.',
          items: {
            type: 'object',
            required: ['slug', 'nombre', 'entidad', 'elegibilidad', 'score', 'razones', 'montoFinanciable', 'cuotaEstimada', 'plazo', 'entradaRequerida', 'capacidadMaxima', 'tasaNominal', 'verificado', 'fechaDato', 'fuenteUrl', 'url'],
            properties: {
              slug: { type: 'string', description: 'Identificador del producto (sirve para detalle_programa y simular_cuota).' },
              nombre: { type: 'string' },
              entidad: { type: 'string', description: 'Slug de la entidad.' },
              entidadNombre: { type: 'string' },
              categoria: { type: 'string', enum: CATEGORIAS },
              elegibilidad: { type: 'string', enum: ['apto', 'condicional', 'no_apto'] },
              score: { type: 'integer', description: 'Puntaje 0–100 (más alto = mejor ajuste al perfil).' },
              razones: { type: 'array', items: { type: 'string' }, description: 'Motivos, condiciones u observaciones.' },
              montoFinanciable: { type: 'number', description: 'Monto que financiaría el producto, en USD.' },
              cuotaEstimada: { type: 'number', description: 'Cuota mensual estimada en USD (capital e interés, sin seguros).' },
              plazo: { type: 'number', description: 'Plazo usado para el cálculo, en años.' },
              entradaRequerida: { type: 'number', description: 'Entrada mínima exigida, en USD.' },
              capacidadMaxima: { type: 'number', description: 'Monto máximo que soportan los ingresos con este producto, en USD.' },
              tasaNominal: nulo('number', 'Tasa nominal anual en %.'),
              verificado: { type: 'boolean', description: 'false = dato preliminar.' },
              fechaDato: { type: 'string', description: 'Fecha del dato (AAAA-MM-DD).' },
              fuenteUrl: { type: 'string', description: 'Fuente oficial del dato.' },
              url: { type: 'string', description: 'Ficha del producto en creditohipotecarioecuador.com.' },
            },
          },
        },
        ...pie,
      },
    },
    ejecutar(args) {
      const a = lector(args, this.inputSchema);
      const incluirNoAptos = a.bool('incluirNoAptos', false);
      const limite = a.num('limite', { min: 1, max: 50, def: 8, entero: true });
      const parcial = {};
      for (const [campo, def] of Object.entries(this.inputSchema.properties)) {
        if (campo === 'incluirNoAptos' || campo === 'limite' || !a.tiene(campo)) continue;
        parcial[campo] = def.type === 'boolean' ? a.bool(campo) : def.type === 'number' ? a.num(campo) : args[campo];
      }
      let perfil;
      try {
        perfil = normalizarPerfil(parcial);
      } catch (e) {
        throw new ErrorDeHerramienta(`Perfil no válido: ${e.message}`);
      }
      const todos = evaluarTodos(programas, perfil);
      const cuenta = (n) => todos.filter((r) => r.elegibilidad === n).length;
      const visibles = (incluirNoAptos ? todos : todos.filter((r) => r.elegibilidad !== 'no_apto')).slice(0, limite);
      const resultados = visibles.map((r) => ({
        slug: r.programa.slug,
        nombre: r.programa.nombre,
        entidad: r.programa.entidad,
        entidadNombre: nombreEntidad(r.programa.entidad),
        categoria: r.programa.categoria,
        elegibilidad: r.elegibilidad,
        score: r.score,
        razones: r.razones,
        montoFinanciable: r2(r.montoFinanciable),
        cuotaEstimada: r2(r.cuotaEstimada),
        plazo: r.plazo,
        entradaRequerida: r2(r.entradaRequerida),
        capacidadMaxima: r2(r.capacidadMaxima),
        tasaNominal: r.programa.tasaNominal ?? null,
        verificado: r.programa.verificado,
        fechaDato: r.programa.fechaDato,
        fuenteUrl: r.programa.fuenteUrl,
        url: urlPrograma(r.programa.slug),
      }));
      const conteo = { evaluados: todos.length, aptos: cuenta('apto'), condicionales: cuenta('condicional'), noAptos: cuenta('no_apto'), devueltos: resultados.length };

      const lineas = [
        `Evaluación para una vivienda de ${usd(perfil.precioVivienda)} (${ETIQUETA_USO[perfil.uso]}), ingreso de ${usd(perfil.ingresoMensual)}/mes, ` +
          `entrada de ${usd(perfil.entradaDisponible)}, deudas de ${usd(perfil.deudasMensuales)}/mes, ${perfil.afiliadoIess ? `afiliado al IESS con ${perfil.aportaciones} aportaciones` : 'sin afiliación al IESS'}, ` +
          `${perfil.edad} años, ${perfil.relacionLaboral}, ${perfil.primeraVivienda ? 'primera vivienda' : 'no es primera vivienda'}, plazo deseado de ${perfil.plazoDeseado} años.`,
        `Resultado: ${conteo.aptos} apto(s), ${conteo.condicionales} condicional(es) y ${conteo.noAptos} no apto(s) de ${conteo.evaluados} productos de crédito evaluados ` +
          `(los bonos y subsidios no se evalúan aquí). Se muestran ${conteo.devueltos}${incluirNoAptos ? '' : ', sin los no aptos'}.`,
      ];
      if (!resultados.length) {
        lineas.push('Ningún producto calza con este perfil. Prueba con más entrada, un plazo mayor o una vivienda de menor precio, o llama de nuevo con incluirNoAptos: true para ver los motivos.');
      }
      resultados.forEach((r, i) => {
        lineas.push(
          '',
          `${i + 1}. ${r.nombre} — ${r.entidadNombre} [${ETIQUETA_ELEGIBILIDAD[r.elegibilidad]}, puntaje ${r.score}/100]`,
          `   Monto financiable: ${usd(r.montoFinanciable)} · Cuota estimada: ${usd(r.cuotaEstimada, 2)}/mes · Plazo: ${r.plazo} años · Tasa nominal: ${pct(r.tasaNominal)}`,
          `   Entrada requerida: ${usd(r.entradaRequerida)} · Monto máximo según ingresos: ${usd(r.capacidadMaxima)}`,
        );
        if (r.razones.length) lineas.push(`   Observaciones: ${r.razones.join(' ')}`);
        lineas.push(`   Dato del ${r.fechaDato}${r.verificado ? '' : ' (preliminar, por verificar)'} · Ficha: ${r.url} · Fuente oficial: ${r.fuenteUrl}`);
      });
      lineas.push('', 'La cuota estimada incluye capital e interés; no incluye seguros de desgravamen e incendio ni gastos legales.');
      return { texto: lineas.join('\n'), datos: { perfil, conteo, resultados, aviso: AVISO, fuente: FUENTE } };
    },
  };

  // ───────── simular_cuota ─────────
  const simularCuota = {
    name: 'simular_cuota',
    title: 'Simular cuota de un crédito hipotecario',
    description:
      'Calcula la cuota mensual fija (sistema francés, tasa nominal anual capitalizada cada mes) de un crédito: cuota, tasa efectiva anual, total de intereses y total pagado, ' +
      'con resumen anual o tabla de amortización mensual opcionales. Indica la tasa con "tasaNominalAnual" o pasa "programa" (slug de un producto) para usar la tasa publicada de ese producto. ' +
      'Úsala para "¿cuánto pagaría al mes por X USD a N años?" o para comparar tasas y plazos. No incluye seguros ni gastos.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['monto', 'plazoAnios'],
      properties: {
        monto: { type: 'number', exclusiveMinimum: 0, description: 'Capital a financiar en USD (precio de la vivienda menos la entrada).' },
        plazoAnios: { type: 'number', exclusiveMinimum: 0, maximum: 40, description: 'Plazo en años (p. ej. 20; admite fracciones como 7.5).' },
        tasaNominalAnual: { type: 'number', minimum: 0, maximum: 100, description: 'Tasa de interés nominal anual en %, p. ej. 8.5. Obligatoria si no se indica "programa"; si se indican ambos, se usa esta.' },
        programa: { type: 'string', description: 'Slug de un producto (p. ej. "biess-credicasa") para tomar su tasa nominal publicada. Ver slugs con listar_programas.' },
        incluirTabla: { type: 'string', enum: ['ninguna', 'anual', 'mensual'], default: 'ninguna', description: '"anual" añade un resumen por año; "mensual" añade la tabla de amortización completa (una fila por cuota). Por defecto "ninguna".' },
      },
    },
    outputSchema: {
      type: 'object',
      required: ['monto', 'plazoAnios', 'numeroCuotas', 'tasaNominalAnual', 'tasaEfectivaAnual', 'cuotaMensual', 'totalIntereses', 'totalPagado', 'aviso', 'fuente'],
      properties: {
        monto: { type: 'number', description: 'USD.' },
        plazoAnios: { type: 'number' },
        numeroCuotas: { type: 'integer', description: 'Número de cuotas mensuales.' },
        tasaNominalAnual: { type: 'number', description: '% anual.' },
        tasaEfectivaAnual: { type: 'number', description: '% anual.' },
        cuotaMensual: { type: 'number', description: 'Cuota fija mensual en USD (capital e interés, sin seguros).' },
        totalIntereses: { type: 'number', description: 'USD.' },
        totalPagado: { type: 'number', description: 'USD (capital más intereses).' },
        programa: { type: 'object', description: 'Producto del que se tomó la tasa, si se indicó.' },
        advertencias: { type: 'array', items: { type: 'string' } },
        resumenAnual: {
          type: 'array',
          description: 'Solo con incluirTabla: "anual".',
          items: { type: 'object', properties: { anio: { type: 'integer' }, cuotas: { type: 'integer' }, capitalPagado: { type: 'number' }, interesPagado: { type: 'number' }, saldoFinal: { type: 'number' } } },
        },
        tabla: {
          type: 'array',
          description: 'Solo con incluirTabla: "mensual".',
          items: { type: 'object', properties: { n: { type: 'integer' }, cuota: { type: 'number' }, interes: { type: 'number' }, capital: { type: 'number' }, saldo: { type: 'number' } } },
        },
        ...pie,
      },
    },
    ejecutar(args) {
      const a = lector(args, this.inputSchema);
      const monto = a.num('monto', { min: 0, exclusivoMin: true, max: 1e9 });
      const plazoAnios = a.num('plazoAnios', { min: 0, exclusivoMin: true, max: 40 });
      const incluirTabla = a.opcion('incluirTabla', ['ninguna', 'anual', 'mensual'], 'ninguna');
      const numeroCuotas = Math.round(plazoAnios * 12);
      if (numeroCuotas < 1) throw new ErrorDeHerramienta('"plazoAnios" debe equivaler al menos a un mes (≈ 0.09).');
      const advertencias = [];
      let tasa;
      let prog = null;
      if (a.tiene('programa')) {
        prog = buscarPrograma(a.texto('programa'));
        if (prog.plazoMaxAnios && plazoAnios > prog.plazoMaxAnios) advertencias.push(`El plazo máximo de ${prog.nombre} es de ${prog.plazoMaxAnios} años.`);
        if (prog.plazoMinAnios && plazoAnios < prog.plazoMinAnios) advertencias.push(`El plazo mínimo de ${prog.nombre} es de ${prog.plazoMinAnios} años.`);
        if (prog.montoMaxUsd && monto > prog.montoMaxUsd) advertencias.push(`El monto máximo de ${prog.nombre} es ${usd(prog.montoMaxUsd)}.`);
        if (prog.montoMinUsd && monto < prog.montoMinUsd) advertencias.push(`El monto mínimo de ${prog.nombre} es ${usd(prog.montoMinUsd)}.`);
      }
      if (a.tiene('tasaNominalAnual')) {
        tasa = a.num('tasaNominalAnual', { min: 0, max: 100 });
        if (prog && prog.tasaNominal !== null && prog.tasaNominal !== tasa) advertencias.push(`Se usó la tasa indicada (${pct(tasa)}), no la publicada de ${prog.nombre} (${pct(prog.tasaNominal)}).`);
      } else if (prog) {
        if (prog.tasaNominal === null || prog.tasaNominal === undefined) {
          throw new ErrorDeHerramienta(`"${prog.slug}" es un ${ETIQUETA_CATEGORIA[prog.categoria] ?? 'producto'} sin tasa de interés publicada; indica "tasaNominalAnual".`);
        }
        tasa = prog.tasaNominal;
      } else {
        throw new ErrorDeHerramienta('Indica "tasaNominalAnual" (en %, p. ej. 8.5) o "programa" (slug de un producto, p. ej. "biess-credicasa").');
      }

      const t = tablaAmortizacion({ monto, tasaNominalAnual: tasa, plazoAnios });
      const datos = {
        monto,
        plazoAnios,
        numeroCuotas,
        tasaNominalAnual: tasa,
        tasaEfectivaAnual: r2(tasaEfectiva(tasa)),
        cuotaMensual: r2(t.cuota),
        totalIntereses: r2(t.totalIntereses),
        totalPagado: r2(t.totalPagado),
      };
      if (prog) datos.programa = { slug: prog.slug, nombre: prog.nombre, entidadNombre: nombreEntidad(prog.entidad), tasaNota: prog.tasaNota ?? null, fechaDato: prog.fechaDato, verificado: prog.verificado, fuenteUrl: prog.fuenteUrl, url: urlPrograma(prog.slug) };
      if (advertencias.length) datos.advertencias = advertencias;

      const lineas = [
        `Crédito de ${usd(monto)} a ${String(plazoAnios).replace('.', ',')} años (${numeroCuotas} cuotas) con tasa nominal anual de ${pct(tasa)} (efectiva ${pct(datos.tasaEfectivaAnual)})` +
          (prog ? `, ${a.tiene('tasaNominalAnual') ? 'producto de referencia' : 'tasa publicada de'} ${prog.nombre} (dato del ${prog.fechaDato}${prog.verificado ? '' : ', preliminar'})` : '') + ':',
        `- Cuota mensual fija: ${usd(datos.cuotaMensual, 2)}`,
        `- Total de intereses: ${usd(datos.totalIntereses, 2)}`,
        `- Total pagado: ${usd(datos.totalPagado, 2)}`,
      ];
      if (prog?.tasaNota) lineas.push(`Sobre la tasa: ${prog.tasaNota}`);
      advertencias.forEach((x) => lineas.push(`Advertencia: ${x}`));
      if (incluirTabla === 'anual') {
        datos.resumenAnual = [];
        for (let i = 0; i < t.tabla.length; i += 12) {
          const filas = t.tabla.slice(i, i + 12);
          datos.resumenAnual.push({
            anio: i / 12 + 1,
            cuotas: filas.length,
            capitalPagado: r2(filas.reduce((s, f) => s + f.capital, 0)),
            interesPagado: r2(filas.reduce((s, f) => s + f.interes, 0)),
            saldoFinal: r2(filas[filas.length - 1].saldo),
          });
        }
        lineas.push('', 'Resumen anual (año | capital pagado | interés pagado | saldo al cierre, en USD):');
        datos.resumenAnual.forEach((f) => lineas.push(`${f.anio} | ${miles(f.capitalPagado, 2)} | ${miles(f.interesPagado, 2)} | ${miles(f.saldoFinal, 2)}`));
      } else if (incluirTabla === 'mensual') {
        datos.tabla = t.tabla.map((f) => ({ n: f.n, cuota: r2(f.cuota), interes: r2(f.interes), capital: r2(f.capital), saldo: r2(f.saldo) }));
        lineas.push('', 'Tabla de amortización (cuota n.º | interés | capital | saldo, en USD):');
        datos.tabla.forEach((f) => lineas.push(`${f.n} | ${miles(f.interes, 2)} | ${miles(f.capital, 2)} | ${miles(f.saldo, 2)}`));
      }
      lineas.push('', 'La cuota incluye capital e interés; no incluye seguros de desgravamen e incendio ni gastos legales.');
      return { texto: lineas.join('\n'), datos: { ...datos, aviso: AVISO, fuente: FUENTE } };
    },
  };

  // ───────── capacidad_de_credito ─────────
  const capacidad = {
    name: 'capacidad_de_credito',
    title: 'Calcular capacidad de crédito según ingresos',
    description:
      'Calcula cuánto crédito soportan unos ingresos: la cuota mensual máxima y el monto máximo financiable a una tasa y un plazo dados. ' +
      'Fórmula (la misma de evaluar_perfil): cuota máxima = ratioCuotaIngreso × (ingresoMensual − deudasMensuales); el monto es el capital que esa cuota paga con sistema francés. ' +
      'Úsala para "¿cuánto me prestan si gano X?" o "¿hasta qué precio de casa puedo aspirar?". El resultado es un techo teórico por ingresos: cada entidad aplica además su propio análisis.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['ingresoMensual', 'tasaNominalAnual', 'plazoAnios'],
      properties: {
        ingresoMensual: { type: 'number', minimum: 0, description: 'Ingreso mensual neto del hogar en USD.' },
        deudasMensuales: { type: 'number', minimum: 0, default: 0, description: 'Cuotas mensuales de otras deudas en USD. Por defecto 0.' },
        tasaNominalAnual: { type: 'number', minimum: 0, maximum: 100, description: 'Tasa nominal anual en %, p. ej. 8.5 (ver tasas reales con listar_programas).' },
        plazoAnios: { type: 'number', exclusiveMinimum: 0, maximum: 40, description: 'Plazo en años.' },
        ratioCuotaIngreso: { type: 'number', exclusiveMinimum: 0, maximum: 1, default: 0.35, description: 'Fracción del ingreso disponible que puede destinarse a la cuota: 0.35 = 35 % (el BIESS usa 0.40). Por defecto 0.35.' },
      },
    },
    outputSchema: {
      type: 'object',
      required: ['ingresoMensual', 'deudasMensuales', 'ingresoDisponible', 'ratioCuotaIngreso', 'tasaNominalAnual', 'plazoAnios', 'cuotaMaxima', 'montoMaximo', 'aviso', 'fuente'],
      properties: {
        ingresoMensual: { type: 'number' },
        deudasMensuales: { type: 'number' },
        ingresoDisponible: { type: 'number', description: 'Ingreso menos deudas, en USD.' },
        ratioCuotaIngreso: { type: 'number' },
        tasaNominalAnual: { type: 'number' },
        plazoAnios: { type: 'number' },
        cuotaMaxima: { type: 'number', description: 'Cuota mensual máxima en USD.' },
        montoMaximo: { type: 'number', description: 'Monto máximo financiable en USD.' },
        ...pie,
      },
    },
    ejecutar(args) {
      const a = lector(args, this.inputSchema);
      const ingresoMensual = a.num('ingresoMensual', { min: 0, max: 1e9 });
      const deudasMensuales = a.num('deudasMensuales', { min: 0, max: 1e9, def: 0 });
      const tasaNominalAnual = a.num('tasaNominalAnual', { min: 0, max: 100 });
      const plazoAnios = a.num('plazoAnios', { min: 0, exclusivoMin: true, max: 40 });
      const ratioCuotaIngreso = a.num('ratioCuotaIngreso', { min: 0, exclusivoMin: true, max: 1, def: 0.35 });
      const ingresoDisponible = Math.max(0, ingresoMensual - deudasMensuales);
      const cuotaMaxima = r2(ingresoDisponible * ratioCuotaIngreso);
      const montoMaximo = r2(capacidadDeCredito(ingresoDisponible, tasaNominalAnual, plazoAnios, ratioCuotaIngreso));
      const texto = [
        `Con un ingreso de ${usd(ingresoMensual)}/mes y deudas de ${usd(deudasMensuales)}/mes (ingreso disponible: ${usd(ingresoDisponible)}), destinando el ${pct(ratioCuotaIngreso * 100, 0)} a la cuota:`,
        `- Cuota mensual máxima: ${usd(cuotaMaxima, 2)}`,
        `- Monto máximo financiable a ${String(plazoAnios).replace('.', ',')} años con tasa nominal de ${pct(tasaNominalAnual)}: ${usd(montoMaximo)}`,
        ingresoDisponible === 0 ? 'Las deudas igualan o superan el ingreso: no queda capacidad de pago.' : 'A ese monto súmale tu entrada para estimar el precio de vivienda al que puedes aspirar. Para ver productos concretos usa evaluar_perfil.',
      ].join('\n');
      return { texto, datos: { ingresoMensual, deudasMensuales, ingresoDisponible, ratioCuotaIngreso, tasaNominalAnual, plazoAnios, cuotaMaxima, montoMaximo, aviso: AVISO, fuente: FUENTE } };
    },
  };

  // ───────── listar_programas ─────────
  const listarProgramas = {
    name: 'listar_programas',
    title: 'Listar créditos y programas de vivienda de Ecuador',
    description:
      'Lista los productos de crédito hipotecario y programas de vivienda de Ecuador (BIESS, Miti-Miti VIS/VIP, bancos, cooperativas, mutualistas, y bonos del Estado) ' +
      'con sus condiciones resumidas: tasa nominal y efectiva, plazo, % de financiamiento, monto máximo, topes de precio e ingresos, si exige IESS, fecha del dato y enlace. ' +
      'Admite filtros por categoría, entidad, destino y solo verificados. Úsala para comparar tasas, ver qué ofrece una entidad u obtener los slugs que piden detalle_programa y simular_cuota.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        categoria: { type: 'string', enum: CATEGORIAS, description: 'publico (BIESS), preferencial (tasa preferencial VIS/VIP "Miti-Miti"), privado (bancos, cooperativas, mutualistas) o subsidio (bonos del Estado).' },
        entidad: { type: 'string', description: 'Slug de la entidad, p. ej. "biess", "banco-pichincha", "jep" (ver listar_entidades).' },
        uso: { type: 'string', enum: USOS, description: 'Destino que debe financiar: vivienda_terminada, construccion, terreno, remodelacion, sustitucion o vis_vip.' },
        soloVerificados: { type: 'boolean', default: false, description: 'true para excluir los datos preliminares (verificado: false). Por defecto false.' },
      },
    },
    outputSchema: {
      type: 'object',
      required: ['total', 'programas', 'aviso', 'fuente'],
      properties: {
        total: { type: 'integer' },
        programas: {
          type: 'array',
          items: {
            type: 'object',
            required: ['slug', 'nombre', 'entidad', 'categoria', 'fechaDato', 'verificado', 'url'],
            properties: {
              slug: { type: 'string' },
              nombre: { type: 'string' },
              entidad: { type: 'string', description: 'Slug de la entidad.' },
              entidadNombre: { type: 'string' },
              categoria: { type: 'string', enum: CATEGORIAS },
              usos: { type: 'array', items: { type: 'string' } },
              tasaNominal: nulo('number', '% anual.'),
              tasaEfectiva: nulo('number', '% anual.'),
              plazoMinAnios: nulo('number', 'Años.'),
              plazoMaxAnios: nulo('number', 'Años.'),
              financiamientoMaxPct: nulo('number', '% máximo del avalúo o precio que financia.'),
              entradaMinPct: nulo('number', '% mínimo de entrada.'),
              montoMinUsd: nulo('number', 'USD.'),
              montoMaxUsd: nulo('number', 'USD.'),
              precioViviendaMinUsd: nulo('number', 'Precio mínimo de la vivienda (USD).'),
              precioViviendaMaxUsd: nulo('number', 'Tope de precio de la vivienda (USD).'),
              ingresoMaxUsd: nulo('number', 'Tope de ingresos familiares mensuales (USD).'),
              requiereAfiliacionIess: { type: 'boolean' },
              aportacionesMinimas: nulo('number', 'Aportaciones mensuales mínimas al IESS.'),
              soloPrimeraVivienda: { type: 'boolean' },
              soloViviendaNueva: { type: 'boolean' },
              fechaDato: { type: 'string' },
              verificado: { type: 'boolean' },
              url: { type: 'string' },
            },
          },
        },
        ...pie,
      },
    },
    ejecutar(args) {
      const a = lector(args, this.inputSchema);
      const categoria = a.opcion('categoria', CATEGORIAS, null);
      const uso = a.opcion('uso', USOS, null);
      const soloVerificados = a.bool('soloVerificados', false);
      let entidad = a.texto('entidad', null);
      if (entidad) {
        const e = entidadPorSlug.get(entidad) ?? entidadPorSlug.get(aSlug(entidad));
        if (!e) throw new ErrorDeHerramienta(`No existe la entidad "${entidad}". Usa listar_entidades para ver los slugs válidos (p. ej. biess, banco-pichincha, jep).`);
        entidad = e.slug;
      }
      const lista = programas
        .filter((p) => (!categoria || p.categoria === categoria) && (!entidad || p.entidad === entidad) && (!uso || p.usos.includes(uso)) && (!soloVerificados || p.verificado))
        .map(resumenPrograma);
      const filtros = [categoria && `categoría ${categoria}`, entidad && `entidad ${entidad}`, uso && `destino ${uso}`, soloVerificados && 'solo verificados'].filter(Boolean);
      const lineas = [`${lista.length} producto(s)${filtros.length ? ` con ${filtros.join(', ')}` : ''} de ${programas.length} en la base:`];
      if (!lista.length) lineas.push('Ningún producto cumple esos filtros; prueba con menos filtros.');
      lista.forEach((r) => {
        const p = programaPorSlug.get(r.slug);
        lineas.push('', `• ${r.nombre} — ${r.entidadNombre} [${r.slug}, ${r.categoria}]`, `  ${lineaCondiciones(p)}`, `  Dato del ${r.fechaDato}${r.verificado ? '' : ' (preliminar, por verificar)'} · ${r.url}`);
      });
      lineas.push('', 'Usa detalle_programa con el slug para ver requisitos, ventajas, desventajas y pasos.');
      return { texto: lineas.join('\n'), datos: { total: lista.length, programas: lista, aviso: AVISO, fuente: FUENTE } };
    },
  };

  // ───────── detalle_programa ─────────
  const detallePrograma = {
    name: 'detalle_programa',
    title: 'Ver la ficha completa de un crédito o programa',
    description:
      'Devuelve la ficha completa de un producto de crédito hipotecario o programa de vivienda de Ecuador a partir de su slug: descripción, para quién es, tasa, plazo, montos, ' +
      'tramos de financiamiento, requisitos, ventajas, desventajas, pasos para solicitarlo, fuente oficial y fecha del dato. ' +
      'Úsala cuando pregunten por un producto concreto (p. ej. "¿qué requisitos tiene CrediCasa del BIESS?"). Obtén el slug con listar_programas o evaluar_perfil.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['slug'],
      properties: { slug: { type: 'string', description: 'Slug del producto, p. ej. "biess-credicasa", "miti-miti-vip", "banco-pichincha-hipotecario".' } },
    },
    outputSchema: {
      type: 'object',
      required: ['programa', 'url', 'aviso', 'fuente'],
      properties: {
        programa: { type: 'object', description: 'Ficha completa: nombre, resumen, descripción, paraQuien, usos, tasas, plazos, montos, topes, tramos, requisitos, ventajas, desventajas, pasos, fuenteUrl, fechaDato y verificado.' },
        entidad: { type: ['object', 'null'], description: 'Entidad que lo ofrece: nombre, tipo, sitio y simulador oficial, cobertura.' },
        url: { type: 'string', description: 'Ficha en creditohipotecarioecuador.com.' },
        ...pie,
      },
    },
    ejecutar(args) {
      const a = lector(args, this.inputSchema);
      const p = buscarPrograma(a.texto('slug'));
      const e = entidadPorSlug.get(p.entidad);
      const entidad = e ? { slug: e.slug, nombre: e.nombre, tipo: e.tipo, sitioUrl: e.sitioUrl ?? null, simuladorUrl: e.simuladorUrl ?? null, cobertura: cobertura(e) } : null;
      const texto = textoFicha(p) + (e?.simuladorUrl ? `\nSimulador oficial de la entidad: ${e.simuladorUrl}` : '');
      return { texto, datos: { programa: { ...p, entidadNombre: nombreEntidad(p.entidad) }, entidad, url: urlPrograma(p.slug), aviso: AVISO, fuente: FUENTE } };
    },
  };

  // ───────── listar_entidades ─────────
  const listarEntidades = {
    name: 'listar_entidades',
    title: 'Listar entidades que dan crédito de vivienda en Ecuador',
    description:
      'Lista las entidades financieras que otorgan crédito de vivienda en Ecuador (BIESS, bancos, cooperativas de ahorro y crédito, mutualistas): nombre, tipo, sitio web, ' +
      'simulador oficial, cobertura por provincia y slugs de sus productos. Admite filtros por tipo y por provincia. ' +
      'Úsala para "¿qué cooperativas dan crédito hipotecario en Loja?" o para obtener el slug de una entidad.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        tipo: { type: 'string', enum: TIPOS_ENTIDAD, description: 'publico (BIESS y entidades estatales), banco, cooperativa o mutualista.' },
        provincia: { type: 'string', description: `Slug de la provincia (minúsculas, sin tildes, con guiones), p. ej. "pichincha", "guayas", "el-oro", "santo-domingo-de-los-tsachilas". Devuelve las entidades con cobertura allí, incluidas las de cobertura nacional.` },
      },
    },
    outputSchema: {
      type: 'object',
      required: ['total', 'entidades', 'aviso', 'fuente'],
      properties: {
        total: { type: 'integer' },
        entidades: {
          type: 'array',
          items: {
            type: 'object',
            required: ['slug', 'nombre', 'tipo', 'cobertura'],
            properties: {
              slug: { type: 'string' },
              nombre: { type: 'string' },
              tipo: { type: 'string', enum: TIPOS_ENTIDAD },
              descripcion: { type: 'string' },
              sitioUrl: nulo('string', 'Sitio web oficial.'),
              simuladorUrl: nulo('string', 'Simulador oficial de la entidad, si existe.'),
              cobertura: { description: '"nacional" o lista de slugs de provincias.', anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
              aliadaMitiMiti: { type: 'boolean', description: 'true si es entidad aliada del programa Tu Casa Miti-Miti.' },
              programas: { type: 'array', items: { type: 'string' }, description: 'Slugs de sus productos en la base.' },
            },
          },
        },
        ...pie,
      },
    },
    ejecutar(args) {
      const a = lector(args, this.inputSchema);
      const tipo = a.opcion('tipo', TIPOS_ENTIDAD, null);
      let provincia = a.texto('provincia', null);
      if (provincia) {
        const s = aSlug(provincia);
        provincia = PROVINCIAS.find((x) => x === s) ?? (s === 'santo-domingo' ? 'santo-domingo-de-los-tsachilas' : null);
        if (!provincia) throw new ErrorDeHerramienta(`No se reconoce la provincia "${args.provincia}". Slugs válidos: ${PROVINCIAS.join(', ')}.`);
      }
      const lista = entidades
        .filter((e) => (!tipo || e.tipo === tipo) && (!provincia || cobertura(e) === 'nacional' || cobertura(e).includes(provincia)))
        .map(resumenEntidad);
      const filtros = [tipo && `tipo ${tipo}`, provincia && `cobertura en ${provincia}`].filter(Boolean);
      const lineas = [`${lista.length} entidad(es)${filtros.length ? ` con ${filtros.join(' y ')}` : ''} de ${entidades.length} en la base:`];
      lista.forEach((r) => {
        lineas.push(
          '',
          `• ${r.nombre} [${r.slug}, ${r.tipo}] — cobertura ${textoCobertura(r.cobertura)}`,
          `  Sitio: ${r.sitioUrl ?? 'sin sitio registrado'}${r.simuladorUrl ? ` · Simulador oficial: ${r.simuladorUrl}` : ''}`,
          `  ${r.programas.length ? `Productos: ${r.programas.join(', ')}` : 'Sin productos registrados en la base'}${r.aliadaMitiMiti ? ' · Aliada de Miti-Miti' : ''}`,
        );
      });
      return { texto: lineas.join('\n'), datos: { total: lista.length, entidades: lista, aviso: AVISO, fuente: FUENTE } };
    },
  };

  // ───────── search / fetch (forma que piden ChatGPT deep research y "company knowledge") ─────────
  const VACIAS = new Set(['de', 'la', 'el', 'los', 'las', 'en', 'para', 'con', 'por', 'del', 'al', 'que', 'un', 'una', 'the', 'of', 'in', 'for', 'and', 'to', 'es', 'se', 'mi', 'me']);
  const documentos = [
    ...programas.map((p) => ({
      id: `programa:${p.slug}`,
      title: `${p.nombre} — ${nombreEntidad(p.entidad)}`,
      url: urlPrograma(p.slug),
      campos: [
        [6, `${p.nombre} ${p.slug}`],
        [4, `${nombreEntidad(p.entidad)} ${p.entidad}`],
        [3, `${p.resumen} ${ETIQUETA_CATEGORIA[p.categoria] ?? ''} ${p.usos.map((u) => ETIQUETA_USO[u] ?? u).join(' ')}`],
        [1, `${p.descripcion} ${p.paraQuien} ${(p.requisitos ?? []).join(' ')} ${(p.ventajas ?? []).join(' ')} ${(p.desventajas ?? []).join(' ')}`],
      ].map(([peso, t]) => [peso, ` ${plano(t)} `]),
    })),
    ...entidades.map((e) => ({
      id: `entidad:${e.slug}`,
      title: `${e.nombre} (entidad)`,
      url: urlEntidad(e),
      campos: [
        [5, `${e.nombre} ${e.slug}`],
        [2, `${e.tipo} ${e.descripcion} ${cobertura(e) === 'nacional' ? 'nacional todo el pais' : cobertura(e).join(' ')}`],
      ].map(([peso, t]) => [peso, ` ${plano(t)} `]),
    })),
  ];

  const search = {
    name: 'search',
    title: 'Buscar en la base de crédito hipotecario de Ecuador',
    description:
      'Busca por palabras clave en la base de productos de crédito hipotecario, programas de vivienda y entidades financieras de Ecuador. ' +
      'Devuelve una lista de resultados con id, título y URL; pasa el id a "fetch" para leer el documento completo. ' +
      'Pensada para investigación (p. ej. ChatGPT deep research). Para evaluar un caso personal usa evaluar_perfil; para cálculos, simular_cuota.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['query'],
      properties: { query: { type: 'string', description: 'Palabras clave en español, p. ej. "BIESS primera vivienda", "cooperativa Loja", "VIS VIP tasa 4,99".' } },
    },
    outputSchema: {
      type: 'object',
      required: ['results'],
      properties: {
        results: {
          type: 'array',
          items: {
            type: 'object',
            required: ['id', 'title', 'url'],
            properties: { id: { type: 'string', description: 'Identificador para "fetch".' }, title: { type: 'string' }, url: { type: 'string', description: 'URL para citar.' } },
          },
        },
      },
    },
    crudo: true,
    ejecutar(args) {
      const a = lector(args, this.inputSchema);
      const consulta = a.texto('query', undefined, 500);
      const todas = plano(consulta).split(' ').filter((t) => t.length > 1);
      const terminos = todas.filter((t) => !VACIAS.has(t));
      const usar = terminos.length ? terminos : todas;
      const puntuados = documentos
        .map((d) => {
          let puntos = 0;
          let aciertos = 0;
          for (const t of usar) {
            let mejor = 0;
            for (const [peso, texto] of d.campos) if (peso > mejor && (texto.includes(` ${t}`) || (t.length > 3 && texto.includes(t)))) mejor = peso;
            if (mejor) aciertos++;
            puntos += mejor;
          }
          return { d, puntos: puntos + aciertos * 10 };
        })
        .filter((x) => x.puntos > 0)
        .sort((x, y) => y.puntos - x.puntos)
        .slice(0, 12);
      return { datos: { results: puntuados.map(({ d }) => ({ id: d.id, title: d.title, url: d.url })) } };
    },
  };

  const fetchDoc = {
    name: 'fetch',
    title: 'Leer un documento de la base de crédito hipotecario',
    description:
      'Devuelve el texto completo de un documento de la base (ficha de un producto de crédito o de una entidad financiera de Ecuador) a partir del id que entrega "search" ' +
      '(formato "programa:<slug>" o "entidad:<slug>"). Incluye título, texto, URL para citar y metadatos (fecha del dato, fuente oficial).',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['id'],
      properties: { id: { type: 'string', description: 'Id devuelto por "search", p. ej. "programa:biess-credicasa" o "entidad:jep".' } },
    },
    outputSchema: {
      type: 'object',
      required: ['id', 'title', 'text', 'url'],
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        text: { type: 'string', description: 'Texto completo del documento.' },
        url: { type: 'string', description: 'URL para citar.' },
        metadata: { type: 'object', description: 'Tipo de documento, fecha del dato, fuente oficial y aviso.' },
      },
    },
    crudo: true,
    ejecutar(args) {
      const a = lector(args, this.inputSchema);
      const id = a.texto('id');
      const [tipo, resto] = id.includes(':') ? [id.slice(0, id.indexOf(':')), id.slice(id.indexOf(':') + 1)] : [null, id];
      const p = tipo !== 'entidad' ? programaPorSlug.get(resto) : undefined;
      const e = !p && tipo !== 'programa' ? entidadPorSlug.get(resto) : undefined;
      if (p) {
        return {
          datos: {
            id: `programa:${p.slug}`,
            title: `${p.nombre} — ${nombreEntidad(p.entidad)}`,
            text: `${textoFicha(p)}\n\n${NOTA}`,
            url: urlPrograma(p.slug),
            metadata: { tipo: 'programa', entidad: nombreEntidad(p.entidad), categoria: p.categoria, fechaDato: p.fechaDato, verificado: p.verificado, fuenteUrl: p.fuenteUrl, sitio: FUENTE.nombre, evaluacionUrl: URL_EVALUACION },
          },
        };
      }
      if (e) {
        return {
          datos: {
            id: `entidad:${e.slug}`,
            title: `${e.nombre} (entidad)`,
            text: `${textoEntidad(e)}\n\n${NOTA}`,
            url: urlEntidad(e),
            metadata: { tipo: 'entidad', tipoEntidad: e.tipo, ...(e.fechaDato ? { fechaDato: e.fechaDato } : {}), ...(e.fuenteUrl ? { fuenteUrl: e.fuenteUrl } : {}), sitio: FUENTE.nombre, evaluacionUrl: URL_EVALUACION },
          },
        };
      }
      throw new ErrorDeHerramienta(`No existe un documento con id "${id}". Usa "search" para obtener ids válidos (formato "programa:<slug>" o "entidad:<slug>").`);
    },
  };

  const lista = [evaluarPerfil, simularCuota, capacidad, listarProgramas, detallePrograma, listarEntidades, search, fetchDoc];
  lista.forEach((h) => { h.annotations = { title: h.title, ...ANOTACIONES }; });
  const porNombre = new Map(lista.map((h) => [h.name, h]));

  return {
    lista,
    existe: (nombre) => porNombre.has(nombre),
    ejecutar(nombre, args) {
      const h = porNombre.get(nombre);
      const r = h.ejecutar(args);
      return { ...r, crudo: Boolean(h.crudo) };
    },
  };
}
