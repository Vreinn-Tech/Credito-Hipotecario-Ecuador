// Transporte stdio: lanza bin/mcp.js como proceso hijo y habla JSON-RPC delimitado por saltos de línea.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PassThrough } from 'node:stream';
import { readFileSync } from 'node:fs';
import { iniciarStdio } from '../src/mcp/index.js';

const BIN = fileURLToPath(new URL('../bin/mcp.js', import.meta.url));

/** Lanza el servidor, envía las líneas dadas, cierra stdin y devuelve { mensajes, stderr, codigo, crudo }. */
function ejecutar(lineas, args = []) {
  return new Promise((resolver, rechazar) => {
    const hijo = spawn(process.execPath, [BIN, ...args], { stdio: ['pipe', 'pipe', 'pipe'] });
    let salida = '';
    let stderr = '';
    hijo.stdout.setEncoding('utf8').on('data', (d) => { salida += d; });
    hijo.stderr.setEncoding('utf8').on('data', (d) => { stderr += d; });
    hijo.on('error', rechazar);
    hijo.on('close', (codigo) => {
      try {
        const mensajes = salida.split('\n').filter(Boolean).map((l) => JSON.parse(l));
        resolver({ mensajes, stderr, codigo, crudo: salida });
      } catch (e) {
        rechazar(new Error(`stdout contiene algo que no es JSON: ${salida.slice(0, 300)} (${e.message})`));
      }
    });
    for (const l of lineas) hijo.stdin.write(typeof l === 'string' ? l : `${JSON.stringify(l)}\n`);
    hijo.stdin.end();
  });
}

const INIT = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'prueba', version: '1' } } };

test('stdio: handshake clásico, tools/list y tools/call; stdout solo con mensajes MCP y salida limpia al cerrar stdin', async () => {
  const { mensajes, stderr, codigo, crudo } = await ejecutar([
    INIT,
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'evaluar_perfil', arguments: { precioVivienda: 70000, ingresoMensual: 1200, afiliadoIess: true, aportaciones: 48 } } },
    { jsonrpc: '2.0', id: 4, method: 'ping' },
  ]);
  assert.equal(codigo, 0);
  assert.deepEqual(mensajes.map((m) => m.id), [1, 2, 3, 4]); // la notificación no genera respuesta
  assert.equal(mensajes[0].result.protocolVersion, '2025-11-25');
  assert.equal(mensajes[0].result.serverInfo.version, JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version);
  assert.equal(mensajes[1].result.tools.length, 8);
  assert.equal(mensajes[2].result.isError, false);
  assert.equal(mensajes[2].result.structuredContent.resultados[0].slug, 'biess-credicasa');
  assert.deepEqual(mensajes[3].result, {});
  assert.ok(crudo.endsWith('\n'));
  assert.equal(crudo.split('\n').filter(Boolean).length, 4); // un mensaje por línea, sin saltos embebidos
  assert.match(stderr, /\[mcp\]/); // los registros van a stderr
});

test('stdio: la versión negociada en initialize condiciona las respuestas (2025-03-26: sin structuredContent, con lotes)', async () => {
  const { mensajes } = await ejecutar([
    { ...INIT, params: { ...INIT.params, protocolVersion: '2025-03-26' } },
    { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'capacidad_de_credito', arguments: { ingresoMensual: 1200, tasaNominalAnual: 8.5, plazoAnios: 20 } } },
    [{ jsonrpc: '2.0', id: 3, method: 'ping' }, { jsonrpc: '2.0', id: 4, method: 'tools/list' }],
  ]);
  assert.equal(mensajes[0].result.protocolVersion, '2025-03-26');
  assert.equal(mensajes[1].result.structuredContent, undefined);
  assert.equal(mensajes[1].result.content.length, 2);
  assert.ok(Array.isArray(mensajes[2]));
  assert.equal(mensajes[2][1].result.tools[0].outputSchema, undefined);
});

test('stdio: era moderna (2026-07-28) sin handshake: server/discover como sonda y tools/call con _meta', async () => {
  const _meta = { 'io.modelcontextprotocol/protocolVersion': '2026-07-28', 'io.modelcontextprotocol/clientCapabilities': {} };
  const { mensajes } = await ejecutar([
    { jsonrpc: '2.0', id: 'd1', method: 'server/discover', params: { _meta } },
    { jsonrpc: '2.0', id: 'c1', method: 'tools/call', params: { name: 'simular_cuota', arguments: { monto: 60000, plazoAnios: 20, tasaNominalAnual: 2.99 }, _meta } },
    { jsonrpc: '2.0', id: 'x1', method: 'tools/list', params: { _meta: { ..._meta, 'io.modelcontextprotocol/protocolVersion': '2099-01-01' } } },
  ]);
  assert.equal(mensajes[0].result.supportedVersions[0], '2026-07-28');
  assert.equal(mensajes[1].result.resultType, 'complete');
  assert.equal(mensajes[1].result.structuredContent.cuotaMensual, 332.46);
  assert.equal(mensajes[2].error.code, -32022);
});

test('stdio: línea que no es JSON → -32700 y el servidor sigue atendiendo; líneas vacías se ignoran', async () => {
  const { mensajes, codigo } = await ejecutar(['esto no es json\n', '\n', '   \n', { jsonrpc: '2.0', id: 7, method: 'ping' }, { jsonrpc: '2.0', id: 8, method: 'nada' }]);
  assert.equal(codigo, 0);
  assert.equal(mensajes.length, 3);
  assert.equal(mensajes[0].error.code, -32700);
  assert.equal(mensajes[0].id, null);
  assert.deepEqual(mensajes[1], { jsonrpc: '2.0', id: 7, result: {} });
  assert.equal(mensajes[2].error.code, -32601);
});

test('stdio: mensajes partidos en varios trozos y última línea sin salto final', async () => {
  const texto = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' });
  const { mensajes } = await ejecutar([texto.slice(0, 10), `${texto.slice(10)}\n${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'ping' })}`]);
  assert.deepEqual(mensajes.map((m) => m.id), [1, 2]);
});

test('bin/mcp.js --version y --help', async () => {
  const v = await new Promise((r) => { let s = ''; const h = spawn(process.execPath, [BIN, '--version']); h.stdout.on('data', (d) => { s += d; }); h.on('close', () => r(s)); });
  assert.match(v, /^\d+\.\d+\.\d+/);
  const a = await new Promise((r) => { let s = ''; const h = spawn(process.execPath, [BIN, '--help']); h.stdout.on('data', (d) => { s += d; }); h.on('close', () => r(s)); });
  assert.match(a, /--http/);
});

test('bin/mcp.js --http: Streamable HTTP local en 127.0.0.1', async () => {
  const hijo = spawn(process.execPath, [BIN, '--http', '0'], { stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const url = await new Promise((resolver, rechazar) => {
      let err = '';
      hijo.stderr.setEncoding('utf8').on('data', (d) => { err += d; const m = /escuchando en (\S+)/.exec(err); if (m) resolver(m[1]); });
      hijo.on('close', () => rechazar(new Error(`el servidor terminó: ${err}`)));
      hijo.on('error', rechazar);
    });
    assert.match(url, /^http:\/\/127\.0\.0\.1:\d+\/mcp$/);
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'listar_entidades', arguments: { tipo: 'mutualista' } } }) });
    assert.equal(r.status, 200);
    assert.ok((await r.json()).result.structuredContent.total > 0);
    assert.equal((await fetch(url, { headers: { accept: 'text/event-stream' } })).status, 405);
    assert.equal((await fetch(url.replace('/mcp', '/otra'))).status, 404);
  } finally {
    hijo.kill();
  }
});

test('iniciarStdio funciona con flujos inyectados (sin proceso hijo)', async () => {
  const leer = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
  const entrada = new PassThrough();
  const salida = new PassThrough();
  let texto = '';
  salida.setEncoding('utf8').on('data', (d) => { texto += d; });
  const fin = iniciarStdio({ programas: leer('programas.json'), entidades: leer('entidades.json'), entrada, salida, log: () => {} });
  entrada.write(`${JSON.stringify(INIT)}\n`);
  entrada.end(`${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'ping' })}\n`);
  await fin;
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(texto.trim().split('\n').map((l) => JSON.parse(l).id), [1, 2]);
});
