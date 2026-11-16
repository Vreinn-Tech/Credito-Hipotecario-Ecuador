#!/usr/bin/env node
/**
 * Regenera las tablas de data/README.md (productos) y README.md (instituciones) a partir de los JSON.
 * Uso: node scripts/generar-tablas.mjs          (reescribe los archivos)
 *      node scripts/generar-tablas.mjs --check  (falla si están desactualizados)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const raiz = new URL('../', import.meta.url);
const leerJson = (ruta) => JSON.parse(readFileSync(new URL(ruta, raiz), 'utf8'));
const celda = (v) => String(v).replace(/\|/g, '\\|');
const pct = (v) => (v === null || v === undefined ? '—' : `${v.toFixed(2).replace('.', ',')} %`);

function financiamiento(p) {
  if (p.tramos?.length) {
    const pcts = p.tramos.map((t) => t.pct);
    const [min, max] = [Math.min(...pcts), Math.max(...pcts)];
    return min === max ? `${max} %` : `${min}–${max} %`;
  }
  return p.financiamientoMaxPct === null ? '—' : `${p.financiamientoMaxPct} %`;
}

export function tablaProgramas(programas = leerJson('data/programas.json'), entidades = leerJson('data/entidades.json')) {
  const nombre = new Map(entidades.map((e) => [e.slug, e.nombre]));
  const filas = programas.map((p) => `| ${[
    `${celda(p.nombre)}${p.verificado ? '' : ' \\*'}`,
    celda(nombre.get(p.entidad) ?? p.entidad),
    pct(p.tasaNominal),
    p.plazoMaxAnios === null ? '—' : `${p.plazoMaxAnios} años`,
    financiamiento(p),
    p.fechaDato,
  ].join(' | ')} |`);
  return [
    '| Producto | Entidad | Tasa nominal | Plazo máx. | Financiamiento máx. | Fecha del dato |',
    '| --- | --- | ---: | ---: | ---: | --- |',
    ...filas,
  ].join('\n');
}

export function tablaEntidades(programas = leerJson('data/programas.json'), entidades = leerJson('data/entidades.json')) {
  const tipos = { publico: 'Pública', banco: 'Banco', cooperativa: 'Cooperativa', mutualista: 'Mutualista' };
  const filas = entidades.map((e) => {
    const n = programas.filter((p) => p.entidad === e.slug).length;
    const cobertura = e.coberturaProvincias === 'nacional' ? 'Nacional'
      : e.coberturaProvincias.length ? e.coberturaProvincias.join(', ') : '—';
    return `| ${[
      e.sitioUrl ? `[${celda(e.nombre)}](${e.sitioUrl})` : celda(e.nombre),
      `\`${e.slug}\``,
      tipos[e.tipo] ?? e.tipo,
      n || '—',
      cobertura,
    ].join(' | ')} |`;
  });
  return [
    '| Institución | Slug | Tipo | Productos con ficha | Cobertura |',
    '| --- | --- | --- | ---: | --- |',
    ...filas,
  ].join('\n');
}

const DESTINOS = [
  { archivo: 'data/README.md', marca: 'tabla:programas', generar: tablaProgramas },
  { archivo: 'README.md', marca: 'tabla:entidades', generar: tablaEntidades },
];

/** Devuelve el contenido que debería tener cada archivo; null si le faltan los marcadores. */
export function contenidoEsperado({ archivo, marca, generar }) {
  const actual = readFileSync(new URL(archivo, raiz), 'utf8');
  const [ini, fin] = [`<!-- ${marca}:inicio -->`, `<!-- ${marca}:fin -->`];
  const [i, j] = [actual.indexOf(ini), actual.indexOf(fin)];
  if (i === -1 || j === -1 || j < i) return { actual, esperado: null };
  return { actual, esperado: `${actual.slice(0, i + ini.length)}\n${generar()}\n${actual.slice(j)}` };
}

export function tablasDesactualizadas() {
  return DESTINOS.filter((d) => {
    const { actual, esperado } = contenidoEsperado(d);
    return esperado === null || esperado !== actual;
  }).map((d) => d.archivo);
}

export function escribirTablas() {
  const cambiados = [];
  for (const d of DESTINOS) {
    const { actual, esperado } = contenidoEsperado(d);
    if (esperado === null) throw new Error(`${d.archivo}: faltan los marcadores <!-- ${d.marca}:inicio/fin -->.`);
    if (esperado !== actual) {
      writeFileSync(new URL(d.archivo, raiz), esperado);
      cambiados.push(d.archivo);
    }
  }
  return cambiados;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    const viejos = tablasDesactualizadas();
    if (viejos.length) {
      console.error(`Tablas desactualizadas en: ${viejos.join(', ')}. Ejecuta "npm run tablas".`);
      process.exit(1);
    }
    console.log('Tablas al día.');
  } else {
    const cambiados = escribirTablas();
    console.log(cambiados.length ? `Tablas regeneradas en: ${cambiados.join(', ')}` : 'Tablas al día; sin cambios.');
  }
}
