#!/usr/bin/env node
/**
 * Empaqueta el plugin para el directorio de ChatGPT (formato Agent Plugins) en
 * dist/credito-hipotecario-ecuador-openai.zip → plataforma de OpenAI > Plugins > Upload plugin.
 *
 * Contenido del ZIP (todo en la raíz, sin carpeta envolvente):
 *   plugin.json                                  ← openai/plugin.json (manifiesto con extensions.com.openai)
 *   mcp.json                                     ← openai/mcp.json (servidor remoto, Streamable HTTP)
 *   skills/credito-hipotecario-ecuador/SKILL.md  ← la misma skill del plugin de Claude (no hay copias)
 *   assets/icon.png                              ← assets/icono-512.png
 *
 * Antes de escribir el ZIP comprueba los límites que publica OpenAI
 * (https://developers.openai.com/plugins/deploy/submission, consultada el 16-nov-2026).
 *
 * El vídeo de demostración (review.demo_recording_url) es opcional en el ZIP pero obligatorio para la revisión.
 * Sin argumentos no se incluye (se puede rellenar en el panel); para meterlo en el ZIP:
 *   node scripts/empaquetar-openai.mjs --demo https://…
 *
 * Uso: node scripts/empaquetar-openai.mjs [--demo URL]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearZip } from './zip.mjs';
import { crearHerramientas } from '../src/mcp/herramientas.js';

const NOMBRE = 'credito-hipotecario-ecuador';
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR_OPENAI = join(RAIZ, 'openai');
const SKILL = join(RAIZ, 'plugins', NOMBRE, 'skills', NOMBRE, 'SKILL.md');
const LOGO = join(RAIZ, 'assets', 'icono-512.png');
const DIST = join(RAIZ, 'dist');
const SALIDA = `${NOMBRE}-openai.zip`;

const leerJson = (ruta) => JSON.parse(readFileSync(ruta, 'utf8'));
const errores = [];
const exigir = (cond, mensaje) => { if (!cond) errores.push(mensaje); };
const largo = (s) => [...(s ?? '')].length;
const maximo = (valor, max, campo) => exigir(typeof valor === 'string' && largo(valor) > 0 && largo(valor) <= max, `${campo}: obligatorio y de ${max} caracteres como máximo (tiene ${largo(valor)}).`);

// ───────────────────────── argumentos ─────────────────────────

const iDemo = process.argv.indexOf('--demo');
const demo = iDemo === -1 ? null : process.argv[iDemo + 1];
if (iDemo !== -1 && !/^https:\/\/\S+$/.test(demo ?? '')) {
  console.error('--demo necesita una URL https:// del vídeo de demostración.');
  process.exit(1);
}

// ───────────────────────── manifiesto ─────────────────────────

const pkg = leerJson(join(RAIZ, 'package.json'));
const manifiesto = leerJson(join(DIR_OPENAI, 'plugin.json'));
const mcp = leerJson(join(DIR_OPENAI, 'mcp.json'));
const oa = manifiesto.extensions?.['com.openai'] ?? {};
const ui = oa.interface ?? {};
const review = oa.review ?? {};
const pub = oa.publication ?? {};

exigir(manifiesto.$schema === 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json', '$schema debe ser el del formato Agent Plugins 1.0.0.');
exigir(manifiesto.name === NOMBRE, `name debe ser "${NOMBRE}".`);
exigir(manifiesto.version === pkg.version, `version (${manifiesto.version}) debe coincidir con package.json (${pkg.version}).`);
maximo(manifiesto.description, 4000, 'description');
maximo(manifiesto.author?.name, 120, 'author.name');

maximo(ui.displayName, 30, 'interface.displayName');
maximo(ui.shortDescription, 30, 'interface.shortDescription');
maximo(ui.longDescription, 4000, 'interface.longDescription');
maximo(ui.developerName, 80, 'interface.developerName');
exigir(typeof ui.category === 'string' && ui.category.trim(), 'interface.category es obligatorio.');
for (const campo of ['websiteURL', 'supportURL', 'privacyPolicyURL', 'termsOfServiceURL']) {
  exigir(/^https:\/\/\S+$/.test(ui[campo] ?? '') && ui[campo].length <= 1024, `interface.${campo}: URL https obligatoria (≤ 1024).`);
}
exigir(Array.isArray(ui.defaultPrompt) && ui.defaultPrompt.length <= 3, 'interface.defaultPrompt: hasta 3.');
for (const p of ui.defaultPrompt ?? []) exigir(largo(p) <= 128 && !/@\w/.test(p), `defaultPrompt de más de 128 caracteres o con mención @: "${p}".`);
for (const campo of ['brandColor', 'brandColorDark']) if (ui[campo] !== undefined) exigir(/^#[0-9a-fA-F]{6}$/.test(ui[campo]), `interface.${campo} debe ser #RRGGBB.`);
exigir(ui.logo === './assets/icon.png', 'interface.logo debe ser "./assets/icon.png" (el archivo que añade este script).');
exigir(!('apps' in manifiesto) && !('hooks' in manifiesto), 'OpenAI no admite apps ni hooks en el ZIP.');

// Casos de prueba: exactamente 5 positivos y 3 negativos para la primera revisión de un MCP.
const nombresHerramientas = new Set(crearHerramientas({ programas: [], entidades: [] }).lista.map((h) => h.name));
const positivos = review.test_cases?.positive ?? [];
const negativos = review.test_cases?.negative ?? [];
exigir(positivos.length === 5, `review.test_cases.positive: se necesitan exactamente 5 (hay ${positivos.length}).`);
exigir(negativos.length === 3, `review.test_cases.negative: se necesitan exactamente 3 (hay ${negativos.length}).`);
for (const [i, c] of [...positivos, ...negativos].entries()) exigir(c.description && c.prompt, `caso ${i + 1}: faltan description o prompt.`);
for (const [i, c] of positivos.entries()) {
  exigir(c.expected_behavior, `caso positivo ${i + 1}: falta expected_behavior.`);
  exigir(Array.isArray(c.tools_triggered) && c.tools_triggered.length, `caso positivo ${i + 1}: falta tools_triggered.`);
  for (const t of c.tools_triggered ?? []) exigir(nombresHerramientas.has(t), `caso positivo ${i + 1}: la herramienta "${t}" no existe.`);
}
for (const prohibido of ['test_credentials', 'reviewer_instructions']) exigir(!(prohibido in review), `review.${prohibido} no va en el ZIP (se introduce en el panel).`);
if (demo) review.demo_recording_url = demo;
if ('demo_recording_url' in review) exigir(/^https:\/\/\S+$/.test(review.demo_recording_url ?? ''), 'review.demo_recording_url debe ser una URL https (o no incluirse).');

exigir(Array.isArray(pub.countries) && pub.countries.every((c) => /^[A-Z]{2}$/.test(c)), 'publication.countries: códigos de país en mayúsculas, p. ej. ["EC"].');
for (const [locale, t] of Object.entries(pub.translations ?? {})) {
  exigir(locale.trim(), 'publication.translations: clave de idioma vacía.');
  if (t.subtitle != null) exigir(largo(t.subtitle) <= 30 && !t.subtitle.includes('\n'), `translations.${locale}.subtitle: una línea de 30 caracteres como máximo.`);
  if (t.description != null) exigir(largo(t.description) <= 4000, `translations.${locale}.description: 4000 caracteres como máximo.`);
}

// El texto orientativo tiene que estar en la ficha (ver docs/open-source/publicacion-directorios.md).
exigir(/must not be used to make decisions about a person's credit/.test(ui.longDescription ?? ''), 'longDescription debe incluir el aviso de uso orientativo.');

// mcp.json: un único servidor remoto, sin cabeceras ni secretos.
const servidores = Object.values(mcp.mcpServers ?? {});
exigir(mcp.$schema === 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json', 'mcp.json: $schema del formato Agent Plugins 1.0.0.');
exigir(servidores.length === 1, 'mcp.json: OpenAI conecta un solo servidor MCP por plugin.');
for (const s of servidores) {
  exigir(s.type === 'streamable-http' && /^https:\/\//.test(s.url ?? ''), 'mcp.json: type "streamable-http" y url https.');
  exigir(!s.headers || !Object.keys(s.headers).length, 'mcp.json: el envío público rechaza headers no vacíos.');
  exigir(!('clientSecret' in s), 'mcp.json: no puede llevar clientSecret.');
}

// Logo: PNG cuadrado de al menos 48×48 y como máximo 4096, ≤ 5 MiB.
exigir(existsSync(LOGO), `Falta ${LOGO}.`);
const logo = existsSync(LOGO) ? readFileSync(LOGO) : Buffer.alloc(0);
if (logo.length) {
  const esPng = logo.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const ancho = esPng ? logo.readUInt32BE(16) : 0;
  const alto = esPng ? logo.readUInt32BE(20) : 0;
  exigir(esPng && ancho === alto && ancho >= 48 && ancho <= 4096 && logo.length <= 5 * 1024 * 1024, `El logo debe ser un PNG cuadrado de 48 a 4096 px y ≤ 5 MiB (es ${ancho}×${alto}).`);
}

if (errores.length) {
  console.error(`El manifiesto de OpenAI no es válido:\n- ${errores.join('\n- ')}`);
  process.exit(1);
}

// ───────────────────────── ZIP ─────────────────────────

const json = (o) => Buffer.from(`${JSON.stringify(o, null, 2)}\n`, 'utf8');
const archivos = [
  { nombre: 'plugin.json', datos: json(manifiesto) },
  { nombre: 'mcp.json', datos: json(mcp) },
  { nombre: `skills/${NOMBRE}/SKILL.md`, datos: readFileSync(SKILL) },
  { nombre: 'assets/icon.png', datos: logo },
];
mkdirSync(DIST, { recursive: true });
const zip = crearZip(archivos);
writeFileSync(join(DIST, SALIDA), zip);

console.log(`Manifiesto válido: ${manifiesto.name} ${manifiesto.version}, ${positivos.length} casos positivos y ${negativos.length} negativos, países ${pub.countries.join(', ')}.`);
console.log(`\ndist/${SALIDA} (${zip.length} bytes) → plataforma de OpenAI > Plugins > Upload plugin`);
for (const a of archivos) console.log(`  ${a.nombre}`);
if (!review.demo_recording_url) {
  console.log('\nPendiente: review.demo_recording_url no va en el ZIP. Añádelo en el panel (Review details) o vuelve a empaquetar con --demo URL antes de enviar a revisión.');
}
console.log(`Comprueba en el panel que la categoría "${ui.category}" existe; si no, cámbiala en openai/plugin.json y vuelve a empaquetar.`);
