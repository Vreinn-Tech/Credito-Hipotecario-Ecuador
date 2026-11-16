#!/usr/bin/env node
/**
 * Prepara la página de GitHub Pages (docs/).
 *
 * GitHub Pages solo sirve la carpeta docs/, así que la demo no puede leer ../src ni ../data.
 * Este script:
 *   1. Copia el motor (src/evaluacion.js, src/finanzas.js) y los datos (data/*.json) a docs/assets/.
 *   2. Regenera en docs/index.html los bloques marcados con <!-- build:NOMBRE --> … <!-- /build:NOMBRE -->
 *      (cifras de cabecera, tabla de productos, lista de entidades y fecha del JSON-LD) a partir de los JSON,
 *      para que la página funcione y sea legible sin JavaScript.
 *
 * Uso: node scripts/build-docs.mjs   (ejecútalo cada vez que cambien src/ o data/)
 * Sin dependencias.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(raiz, 'docs', 'assets');
const SITIO = 'https://creditohipotecarioecuador.com';
const REPO = 'https://github.com/Vreinn-Tech/Credito-Hipotecario-Ecuador';
const RAW = 'https://raw.githubusercontent.com/Vreinn-Tech/Credito-Hipotecario-Ecuador/main';

await mkdir(assets, { recursive: true });

// 1. Copias del motor y de los datos -------------------------------------------------------
for (const nombre of ['evaluacion.js', 'finanzas.js']) {
  const fuente = await readFile(join(raiz, 'src', nombre), 'utf8');
  const aviso = `// ARCHIVO GENERADO por scripts/build-docs.mjs a partir de src/${nombre}. No lo edites aquí: cambia el original y vuelve a ejecutar el script.\n`;
  await writeFile(join(assets, nombre), aviso + fuente);
}
const programas = JSON.parse(await readFile(join(raiz, 'data', 'programas.json'), 'utf8'));
const entidades = JSON.parse(await readFile(join(raiz, 'data', 'entidades.json'), 'utf8'));
// Los JSON no admiten comentarios: se copian tal cual (compactados) y el aviso va en LEEME.txt.
await writeFile(join(assets, 'programas.json'), JSON.stringify(programas));
await writeFile(join(assets, 'entidades.json'), JSON.stringify(entidades));
await writeFile(
  join(assets, 'LEEME.txt'),
  'evaluacion.js, finanzas.js, programas.json y entidades.json son COPIAS GENERADAS por scripts/build-docs.mjs\n' +
    'a partir de src/ y data/. No las edites aquí: cambia los originales y ejecuta `node scripts/build-docs.mjs`.\n',
);

// 2. Bloques estáticos de index.html ------------------------------------------------------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const esIso = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v);
// Algunos registros aún no tienen fecha confirmada (valor ausente o no ISO): se muestran como «sin confirmar».
const fecha = (iso) => {
  if (!esIso(iso)) return 'sin confirmar';
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${MESES[m - 1]} ${a}`;
};
const pct = (v, dec = 2) => (v == null ? '—' : `${v.toFixed(dec).replace('.', ',')}\u00a0%`);
const corto = (nombre) => nombre.replace(/\s*\(.*\)\s*$/, '');
const entidadDe = new Map(entidades.map((e) => [e.slug, e]));

const GRUPOS = { biess: 'BIESS', vis: 'VIS/VIP', banco: 'Bancos', cooperativa: 'Cooperativas', mutualista: 'Mutualistas', bono: 'Bonos' };
const grupoDe = (p) => {
  if (p.categoria === 'subsidio') return 'bono';
  if (p.categoria === 'preferencial') return 'vis';
  if (p.categoria === 'publico') return 'biess';
  return entidadDe.get(p.entidad)?.tipo ?? 'banco';
};

const creditos = programas.filter((p) => p.categoria !== 'subsidio');
const bonos = programas.length - creditos.length;
const conTasa = programas.filter((p) => typeof p.tasaNominal === 'number');
const masBarato = conTasa.reduce((a, b) => (b.tasaNominal < a.tasaNominal ? b : a));
const tasaMax = Math.max(...conTasa.map((p) => p.tasaNominal));
const verificados = programas.filter((p) => p.verificado).length;
const ultimaFecha = [...programas.map((p) => p.fechaDato), ...entidades.map((e) => e.fechaDato)].filter(esIso).sort().at(-1);
const porTipo = (t) => entidades.filter((e) => e.tipo === t).length;
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const desgloseEntidades = [
  plural(porTipo('banco'), 'banco', 'bancos'),
  plural(porTipo('cooperativa'), 'cooperativa', 'cooperativas'),
  plural(porTipo('mutualista'), 'mutualista', 'mutualistas'),
  plural(porTipo('publico'), 'entidad pública', 'entidades públicas'),
].join(', ');

const bloques = {};

// Intención de desarrollador (código, datos, MCP). La intención de consumidor se cede al sitio con enlaces contextuales.
bloques.lead = `Código abierto del motor de elegibilidad y datos abiertos de ${programas.length} productos y ${entidades.length} entidades (BIESS, VIS/VIP, bancos, cooperativas y mutualistas): librería de JavaScript, CLI, JSON y servidor MCP. Es la base técnica de <a href="${SITIO}/">creditohipotecarioecuador.com</a>, el comparador de crédito hipotecario de Ecuador.`;

bloques.stats = `
          <div class="stat"><dt>productos</dt><dd>${programas.length}</dd><p>${creditos.length} créditos y ${plural(bonos, 'bono', 'bonos')} del Estado</p></div>
          <div class="stat"><dt>entidades</dt><dd>${entidades.length}</dd><p>${desgloseEntidades}</p></div>
          <div class="stat"><dt>tasa nominal desde</dt><dd>${pct(masBarato.tasaNominal)}</dd><p>${esc(masBarato.nombre.replace(/\s+[\d,]+\s*%$/, ''))}; la más alta, ${pct(tasaMax)}</p></div>
          <div class="stat"><dt>datos verificados</dt><dd>${verificados}<small> de ${programas.length}</small></dd><p>Último dato: ${fecha(ultimaFecha)}</p></div>
        `;

bloques.resumen = `${programas.length} productos de ${new Set(programas.map((p) => p.entidad)).size} entidades, con tasas nominales entre ${pct(masBarato.tasaNominal)} y ${pct(tasaMax)}. ${verificados} fichas están verificadas contra la fuente oficial y ${programas.length - verificados} siguen por verificar. Último dato registrado: ${fecha(ultimaFecha)}.`;

bloques.tabla = '\n' + programas.map((p) => {
  const e = entidadDe.get(p.entidad);
  const ent = corto(e?.nombre ?? p.entidad);
  const g = grupoDe(p);
  const fin = p.financiamientoMaxPct;
  const estado = p.verificado
    ? '<span class="estado estado-ok">Verificado</span>'
    : '<span class="estado estado-pend">Por verificar</span>';
  const texto = `${p.nombre} ${ent} ${GRUPOS[g]}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return `            <tr data-grupo="${g}" data-nombre="${esc(p.nombre.toLowerCase())}" data-entidad="${esc(ent.toLowerCase())}" data-tasa="${p.tasaNominal ?? ''}" data-plazo="${p.plazoMaxAnios ?? ''}" data-fin="${fin ?? ''}" data-fecha="${esIso(p.fechaDato) ? p.fechaDato : ''}" data-estado="${p.verificado ? 1 : 0}" data-texto="${esc(texto)}">
              <th scope="row"><a href="${SITIO}/programas/${p.slug}/">${esc(p.nombre)}</a><span class="m-meta">${esc(ent)} · ${esIso(p.fechaDato) ? fecha(p.fechaDato) : 'fecha sin confirmar'} · ${p.verificado ? 'verificado' : 'por verificar'}</span></th>
              <td class="c-ent">${esc(ent)}${GRUPOS[g] === ent ? '' : `<span class="tipo">${GRUPOS[g]}</span>`}</td>
              <td class="num" data-l="Tasa nominal">${pct(p.tasaNominal)}</td>
              <td class="num" data-l="Plazo máx.">${p.plazoMaxAnios == null ? '—' : `${p.plazoMaxAnios} años`}</td>
              <td class="num" data-l="Financia hasta">${fin == null ? '—' : `${String(fin).replace('.', ',')}\u00a0%`}</td>
              <td class="c-fecha">${esIso(p.fechaDato) ? `<time datetime="${p.fechaDato}">${fecha(p.fechaDato)}</time>` : '<span class="sin-fecha">Sin confirmar</span>'}</td>
              <td class="c-estado">${estado}</td>
            </tr>`;
}).join('\n') + '\n          ';

const TIPOS = [['publico', 'Públicas'], ['banco', 'Bancos'], ['mutualista', 'Mutualistas'], ['cooperativa', 'Cooperativas']];
bloques.entidades = '\n' + TIPOS.map(([t, etiqueta]) => {
  const lista = entidades.filter((e) => e.tipo === t);
  return `          <div class="ent-grupo"><h4>${etiqueta} <span>${lista.length}</span></h4><ul>${lista.map((e) => `<li>${esc(corto(e.nombre))}</li>`).join('')}</ul></div>`;
}).join('\n') + '\n        ';

bloques.nentidades = String(entidades.length);

bloques.jsonld = `
<script type="application/ld+json">
${JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITIO}/#organizacion`,
      name: 'Crédito Hipotecario Ecuador',
      url: SITIO,
      sameAs: [REPO],
    },
    {
      '@type': 'SoftwareSourceCode',
      '@id': 'https://vreinn-tech.github.io/Credito-Hipotecario-Ecuador/#codigo',
      name: 'credito-hipotecario-ecuador',
      description: 'Librería de JavaScript sin dependencias, CLI y servidor MCP con el motor de elegibilidad y el cálculo de cuotas de crédito de vivienda en Ecuador (BIESS, VIS/VIP, bancos, cooperativas y mutualistas).',
      url: 'https://vreinn-tech.github.io/Credito-Hipotecario-Ecuador/',
      codeRepository: REPO,
      programmingLanguage: 'JavaScript',
      runtimePlatform: 'Node.js, navegadores',
      license: 'https://opensource.org/licenses/MIT',
      inLanguage: 'es',
      isBasedOn: `${SITIO}/`,
      author: { '@id': `${SITIO}/#organizacion` },
      publisher: { '@id': `${SITIO}/#organizacion` },
    },
    {
      '@type': 'Dataset',
      '@id': 'https://vreinn-tech.github.io/Credito-Hipotecario-Ecuador/#datos',
      name: 'Productos y entidades de crédito hipotecario en Ecuador',
      description: `Condiciones referenciales de ${programas.length} productos de crédito de vivienda y bonos, y ficha de ${entidades.length} entidades financieras de Ecuador: tasa nominal, plazo, financiamiento máximo, requisitos, fuente y fecha de cada dato.`,
      url: 'https://vreinn-tech.github.io/Credito-Hipotecario-Ecuador/#datos',
      license: 'https://creativecommons.org/licenses/by/4.0/',
      inLanguage: 'es',
      spatialCoverage: { '@type': 'Country', name: 'Ecuador' },
      dateModified: ultimaFecha,
      isAccessibleForFree: true,
      keywords: ['datos abiertos', 'crédito hipotecario', 'Ecuador', 'BIESS', 'VIS', 'VIP', 'tasas de interés', 'vivienda'],
      variableMeasured: ['tasa nominal anual', 'tasa efectiva anual', 'plazo máximo', 'financiamiento máximo', 'monto máximo', 'requisitos', 'fecha del dato', 'fuente oficial'],
      creditText: 'Fuente: creditohipotecarioecuador.com',
      sameAs: `${REPO}/tree/main/data`,
      isBasedOn: `${SITIO}/`,
      creator: { '@id': `${SITIO}/#organizacion` },
      publisher: { '@id': `${SITIO}/#organizacion` },
      distribution: [
        { '@type': 'DataDownload', name: 'programas.json', encodingFormat: 'application/json', contentUrl: `${RAW}/data/programas.json` },
        { '@type': 'DataDownload', name: 'entidades.json', encodingFormat: 'application/json', contentUrl: `${RAW}/data/entidades.json` },
      ],
    },
  ],
}, null, 1)}
</script>
`;

const rutaHtml = join(raiz, 'docs', 'index.html');
let html;
try {
  html = await readFile(rutaHtml, 'utf8');
} catch {
  console.log('docs/assets/ actualizado. (docs/index.html no existe todavía: no se regeneran bloques.)');
  process.exit(0);
}
for (const [nombre, contenido] of Object.entries(bloques)) {
  const re = new RegExp(`(<!-- build:${nombre} -->)[\\s\\S]*?(<!-- /build:${nombre} -->)`, 'g');
  if (!re.test(html)) throw new Error(`Falta el bloque <!-- build:${nombre} --> en docs/index.html`);
  html = html.replace(re, (_, a, b) => a + contenido + b);
}
await writeFile(rutaHtml, html);
console.log(`docs/ listo: ${programas.length} productos, ${entidades.length} entidades, último dato ${ultimaFecha}.`);
