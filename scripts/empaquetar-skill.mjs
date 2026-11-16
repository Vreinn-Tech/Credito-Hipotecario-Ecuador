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
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearZip, leerCarpeta } from './zip.mjs';

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
