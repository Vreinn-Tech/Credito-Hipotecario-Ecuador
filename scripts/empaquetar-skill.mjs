#!/usr/bin/env node
/**
 * Empaqueta la skill y el plugin de Claude en dist/ para subirlos a claude.ai o Claude Desktop:
 *
 *   dist/credito-hipotecario-ecuador-skill.zip   → Customize > Skills > "+" > Create skill > Upload a skill
 *   dist/credito-hipotecario-ecuador-plugin.zip  → Customize > Plugins > Add > Upload plugin
 *
 * La única fuente es plugins/credito-hipotecario-ecuador/ (no hay copias del SKILL.md).
 * Sin dependencias: escribe el ZIP con node:zlib, así que funciona igual en Linux, macOS y Windows.
 *
 * Uso: node scripts/empaquetar-skill.mjs
 */
import { deflateRawSync } from 'node:zlib';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const NOMBRE = 'credito-hipotecario-ecuador';
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR_PLUGIN = join(RAIZ, 'plugins', NOMBRE);
const DIR_SKILL = join(DIR_PLUGIN, 'skills', NOMBRE);
const DIST = join(RAIZ, 'dist');

// Límites que publica Anthropic para las skills que se suben a claude.ai:
// https://support.claude.com/en/articles/12512198-how-to-create-custom-skills
const MAX_NOMBRE = 64;
const MAX_DESCRIPCION = 200;

// ───────────────────────── validación del SKILL.md ─────────────────────────

function validarSkill() {
  const texto = readFileSync(join(DIR_SKILL, 'SKILL.md'), 'utf8');
  const fm = texto.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!fm) throw new Error('SKILL.md debe empezar con un bloque de frontmatter YAML entre líneas "---".');
  const campo = (c) => fm[1].match(new RegExp(`^${c}:[ \\t]*(.+)$`, 'm'))?.[1].trim().replace(/^(["'])(.*)\1$/, '$2');
  const name = campo('name');
  const description = campo('description');
  if (!name || !description) throw new Error('El frontmatter de SKILL.md necesita "name" y "description" en una sola línea cada uno.');
  if (name !== NOMBRE) throw new Error(`"name" (${name}) debe coincidir con el nombre de la carpeta (${NOMBRE}).`);
  if (name.length > MAX_NOMBRE || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
    throw new Error(`"name" debe usar minúsculas, dígitos y guiones, con ${MAX_NOMBRE} caracteres como máximo.`);
  }
  const largo = [...description].length;
  if (largo > MAX_DESCRIPCION) throw new Error(`"description" tiene ${largo} caracteres; claude.ai admite ${MAX_DESCRIPCION} como máximo.`);
  if (/[<>]/.test(description)) throw new Error('"description" no puede contener "<" ni ">".');
  return { name, largo };
}

// ───────────────────────── ZIP mínimo (formato PKZIP 2.0, deflate, nombres en UTF-8) ─────────────────────────

const TABLA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = TABLA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Fecha fija: el mismo contenido produce siempre el mismo ZIP, byte a byte. */
const FECHA_DOS = ((2026 - 1980) << 9) | (1 << 5) | 1;
const HORA_DOS = 0;

/** @param {Array<{nombre: string, datos: Buffer}>} archivos nombres con "/" como separador */
function crearZip(archivos) {
  const partes = [];
  const central = [];
  let offset = 0;
  for (const { nombre, datos } of archivos) {
    const nombreBuf = Buffer.from(nombre, 'utf8');
    const comprimido = deflateRawSync(datos, { level: 9 });
    const comun = Buffer.alloc(26);
    comun.writeUInt16LE(20, 0); // versión necesaria: 2.0
    comun.writeUInt16LE(0x0800, 2); // bit 11: nombre en UTF-8
    comun.writeUInt16LE(8, 4); // método: deflate
    comun.writeUInt16LE(HORA_DOS, 6);
    comun.writeUInt16LE(FECHA_DOS, 8);
    comun.writeUInt32LE(crc32(datos), 10);
    comun.writeUInt32LE(comprimido.length, 14);
    comun.writeUInt32LE(datos.length, 18);
    comun.writeUInt16LE(nombreBuf.length, 22);
    comun.writeUInt16LE(0, 24); // sin campo extra

    const local = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), comun, nombreBuf, comprimido]);
    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE((3 << 8) | 20, 4); // creado en Unix, versión 2.0
    comun.copy(dir, 6);
    dir.writeUInt32LE((0o100644 << 16) >>> 0, 38); // permisos rw-r--r--
    dir.writeUInt32LE(offset, 42);
    central.push(dir, nombreBuf);
    partes.push(local);
    offset += local.length;
  }
  const dirCentral = Buffer.concat(central);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(archivos.length, 8);
  fin.writeUInt16LE(archivos.length, 10);
  fin.writeUInt32LE(dirCentral.length, 12);
  fin.writeUInt32LE(offset, 16);
  return Buffer.concat([...partes, dirCentral, fin]);
}

/** Archivos de una carpeta (recursivo, orden estable), con el prefijo dado dentro del ZIP. */
function leerCarpeta(dir, prefijo = '') {
  const IGNORAR = new Set(['.DS_Store', 'Thumbs.db']);
  const salida = [];
  const recorrer = (actual) => {
    for (const e of readdirSync(actual, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const ruta = join(actual, e.name);
      if (IGNORAR.has(e.name)) continue;
      if (e.isDirectory()) recorrer(ruta);
      else if (e.isFile()) salida.push({ nombre: prefijo + relative(dir, ruta).split(sep).join('/'), datos: readFileSync(ruta) });
    }
  };
  recorrer(dir);
  return salida;
}

// ───────────────────────── principal ─────────────────────────

const { name, largo } = validarSkill();
mkdirSync(DIST, { recursive: true });

const paquetes = [
  // claude.ai exige que el ZIP contenga la carpeta de la skill (con su mismo nombre) y dentro el SKILL.md.
  { archivo: `${NOMBRE}-skill.zip`, archivos: leerCarpeta(DIR_SKILL, `${NOMBRE}/`), destino: 'Customize > Skills' },
  // El plugin completo (manifiesto, .mcp.json y skill): el ZIP contiene un único .claude-plugin/plugin.json.
  { archivo: `${NOMBRE}-plugin.zip`, archivos: leerCarpeta(DIR_PLUGIN), destino: 'Customize > Plugins' },
];

console.log(`SKILL.md válido: name "${name}", description de ${largo} caracteres (máx. ${MAX_DESCRIPCION}).`);
for (const p of paquetes) {
  const zip = crearZip(p.archivos);
  writeFileSync(join(DIST, p.archivo), zip);
  console.log(`\ndist/${p.archivo} (${zip.length} bytes) → ${p.destino}`);
  for (const a of p.archivos) console.log(`  ${a.nombre}`);
}
