/**
 * ZIP reproducible sin dependencias (lo usan empaquetar-skill.mjs y empaquetar-openai.mjs).
 * Fecha fija y orden estable: el mismo contenido produce siempre el mismo ZIP, byte a byte.
 */
import { deflateRawSync } from 'node:zlib';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

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
export function crearZip(archivos) {
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
export function leerCarpeta(dir, prefijo = '') {
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
