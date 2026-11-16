#!/usr/bin/env node
/**
 * Servidor MCP de crédito hipotecario Ecuador.
 *   credito-hipotecario-ecuador-mcp                 → transporte stdio (para Claude Desktop, Claude Code, Cursor, etc.)
 *   credito-hipotecario-ecuador-mcp --http [puerto] → Streamable HTTP en http://127.0.0.1:<puerto>/mcp (por defecto 3333)
 * Por stdout solo salen mensajes MCP; los registros van a stderr.
 */
import { readFileSync } from 'node:fs';
import { iniciarStdio } from '../src/mcp/stdio.js';

const leer = (ruta) => JSON.parse(readFileSync(new URL(ruta, import.meta.url), 'utf8'));
const args = process.argv.slice(2);
const { version } = leer('../package.json');

if (args.includes('--help') || args.includes('-h')) {
  process.stdout.write(`credito-hipotecario-ecuador-mcp ${version}
Servidor MCP (Model Context Protocol) con el evaluador y los datos de crédito de vivienda de Ecuador.

Uso:
  credito-hipotecario-ecuador-mcp                    Transporte stdio (lo lanza tu cliente MCP)
  credito-hipotecario-ecuador-mcp --http [puerto]    Streamable HTTP local en http://127.0.0.1:<puerto>/mcp (3333 por defecto)
  credito-hipotecario-ecuador-mcp --version

Documentación: https://github.com/Vreinn-Tech/Credito-Hipotecario-Ecuador/blob/main/docs/mcp.md
Servidor público: https://creditohipotecarioecuador.com/mcp
`);
  process.exit(0);
}
if (args.includes('--version') || args.includes('-v')) {
  process.stdout.write(`${version}\n`);
  process.exit(0);
}

const datos = { programas: leer('../data/programas.json'), entidades: leer('../data/entidades.json'), version };

const iHttp = args.indexOf('--http');
if (iHttp !== -1) {
  const puerto = Number(args[iHttp + 1] ?? process.env.PORT ?? 3333);
  if (!Number.isInteger(puerto) || puerto < 0 || puerto > 65535) {
    process.stderr.write('Puerto no válido. Ejemplo: credito-hipotecario-ecuador-mcp --http 3333\n');
    process.exit(2);
  }
  const { escucharHttp } = await import('../src/mcp/nodo.js');
  const { url } = await escucharHttp({ ...datos, puerto, host: process.env.HOST ?? '127.0.0.1' });
  process.stderr.write(`[mcp] credito-hipotecario-ecuador ${version} escuchando en ${url}\n`);
} else {
  process.stderr.write(`[mcp] credito-hipotecario-ecuador ${version} listo (stdio)\n`);
  await iniciarStdio(datos);
}
