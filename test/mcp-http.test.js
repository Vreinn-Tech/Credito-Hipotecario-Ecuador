// Transporte Streamable HTTP sin estado: se prueba con objetos Request/Response reales (los mismos que en Workers).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { crearManejadorHttp } from '../src/mcp/index.js';

const leer = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const datos = { programas: leer('programas.json'), entidades: leer('entidades.json') };
const manejar = crearManejadorHttp(datos);
const URL_MCP = 'https://creditohipotecarioecuador.com/mcp';

const post = (cuerpo, cabeceras = {}, url = URL_MCP) =>
  manejar(new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...cabeceras },
    body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo),
  }));
const META = { 'io.modelcontextprotocol/protocolVersion': '2026-07-28', 'io.modelcontextprotocol/clientCapabilities': {} };
const moderno = (method, params = {}, cabeceras = {}) =>
  post({ jsonrpc: '2.0', id: 1, method, params: { ...params, _meta: META } }, { 'mcp-protocol-version': '2026-07-28', 'mcp-method': method, ...cabeceras });

test('POST initialize → 200 application/json, sin sesión, no-store y CORS abierto', async () => {
  const r = await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'x', version: '1' } } });
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /^application\/json/);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.equal(r.headers.get('access-control-allow-origin'), '*');
  assert.equal(r.headers.get('mcp-session-id'), null);
  const cuerpo = await r.json();
  assert.equal(cuerpo.result.protocolVersion, '2025-11-25');
  assert.equal(cuerpo.result.serverInfo.name, 'credito-hipotecario-ecuador');
});

test('POST tools/list y tools/call (era clásica, con cabecera de versión y Mcp-Session-Id ignorado)', async () => {
  const cab = { 'mcp-protocol-version': '2025-11-25', 'mcp-session-id': 'lo-que-sea' };
  const lista = await (await post({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, cab)).json();
  assert.equal(lista.result.tools.length, 8);
  const r = await post({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'evaluar_perfil', arguments: { precioVivienda: 70000, ingresoMensual: 1200, afiliadoIess: true, aportaciones: 48 } } }, cab);
  assert.equal(r.status, 200);
  const cuerpo = await r.json();
  assert.equal(cuerpo.id, 3);
  assert.equal(cuerpo.result.isError, false);
  assert.ok(cuerpo.result.structuredContent.resultados.length > 0);
});

test('/mcp/ (con barra final) también funciona', async () => {
  const r = await post({ jsonrpc: '2.0', id: 1, method: 'ping' }, {}, `${URL_MCP}/`);
  assert.equal(r.status, 200);
  assert.deepEqual((await r.json()).result, {});
});

test('notificaciones y respuestas del cliente → 202 sin cuerpo', async () => {
  for (const m of [{ jsonrpc: '2.0', method: 'notifications/initialized' }, { jsonrpc: '2.0', id: 5, result: {} }]) {
    const r = await post(m);
    assert.equal(r.status, 202);
    assert.equal(await r.text(), '');
    assert.equal(r.headers.get('access-control-allow-origin'), '*');
  }
});

test('errores JSON-RPC de la era clásica viajan con 200; el error de herramienta es un resultado', async () => {
  const r = await post({ jsonrpc: '2.0', id: 4, method: 'nada' }, { 'mcp-protocol-version': '2025-06-18' });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).error.code, -32601);
  const h = await (await post({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'simular_cuota', arguments: { monto: 1 } } })).json();
  assert.equal(h.result.isError, true);
});

test('cuerpo inválido: JSON roto → 400 -32700; no JSON-RPC → 400 -32600; tipo incorrecto → 415; demasiado grande → 413', async () => {
  const roto = await post('{"jsonrpc": "2.0", ');
  assert.equal(roto.status, 400);
  const cuerpo = await roto.json();
  assert.equal(cuerpo.error.code, -32700);
  assert.equal(cuerpo.id, null);

  const vacio = await post('');
  assert.equal(vacio.status, 400);
  assert.equal((await vacio.json()).error.code, -32700);

  const noRpc = await post({ hola: 'mundo' });
  assert.equal(noRpc.status, 400);
  assert.equal((await noRpc.json()).error.code, -32600);

  const texto = await manejar(new Request(URL_MCP, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' }));
  assert.equal(texto.status, 415);

  const grande = await post({ jsonrpc: '2.0', id: 1, method: 'ping', params: { relleno: 'x'.repeat(300000) } });
  assert.equal(grande.status, 413);
  // sin Content-Length (cuerpo en streaming) el tope se aplica igual
  const flujo = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(`{"relleno":"${'x'.repeat(300000)}"}`)); c.close(); } });
  const enFlujo = await manejar(new Request(URL_MCP, { method: 'POST', headers: { 'content-type': 'application/json' }, body: flujo, duplex: 'half' }));
  assert.equal(enFlujo.status, 413);
  const pequeno = crearManejadorHttp({ ...datos, maxBytes: 20 });
  assert.equal((await pequeno(new Request(URL_MCP, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }) }))).status, 413);
});

test('OPTIONS → 204 con las cabeceras CORS necesarias', async () => {
  const r = await manejar(new Request(URL_MCP, { method: 'OPTIONS', headers: { origin: 'https://claude.ai', 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type, mcp-protocol-version' } }));
  assert.equal(r.status, 204);
  assert.equal(r.headers.get('access-control-allow-origin'), '*');
  assert.match(r.headers.get('access-control-allow-methods'), /POST/);
  const permitidas = r.headers.get('access-control-allow-headers');
  for (const h of ['content-type', 'mcp-protocol-version', 'mcp-session-id', 'authorization', 'mcp-method', 'mcp-name']) assert.ok(permitidas.includes(h), h);
});

test('GET: SSE → 405; navegador → página HTML con enlaces; otros → 405 con JSON explicativo; DELETE → 405', async () => {
  const sse = await manejar(new Request(URL_MCP, { headers: { accept: 'text/event-stream' } }));
  assert.equal(sse.status, 405);
  assert.match(sse.headers.get('allow'), /POST/);

  const html = await manejar(new Request(URL_MCP, { headers: { accept: 'text/html,application/xhtml+xml,*/*;q=0.8' } }));
  assert.equal(html.status, 200);
  assert.match(html.headers.get('content-type'), /^text\/html/);
  assert.equal(html.headers.get('cache-control'), 'no-store');
  const pagina = await html.text();
  assert.match(pagina, /<html lang="es">/);
  assert.match(pagina, /href="https:\/\/creditohipotecarioecuador\.com\/"/);
  assert.match(pagina, /docs\/mcp\.md/);
  assert.match(pagina, /evaluar_perfil/);
  assert.match(pagina, /https:\/\/creditohipotecarioecuador\.com\/mcp</);

  const curl = await manejar(new Request(URL_MCP, { headers: { accept: '*/*' } }));
  assert.equal(curl.status, 405);
  const info = await curl.json();
  assert.ok(info.error.data.herramientas.includes('evaluar_perfil'));
  assert.match(info.error.data.documentacion, /mcp\.md/);

  const del = await manejar(new Request(URL_MCP, { method: 'DELETE', headers: { 'mcp-session-id': 'x' } }));
  assert.equal(del.status, 405);
  assert.equal((await manejar(new Request(URL_MCP, { method: 'PUT', body: '{}' }))).status, 405);
});

test('lotes por HTTP: sin cabecera de versión (clientes 2025-03-26) se atienden; con 2025-06-18+ → 400', async () => {
  const lote = [{ jsonrpc: '2.0', id: 1, method: 'ping' }, { jsonrpc: '2.0', method: 'notifications/initialized' }, { jsonrpc: '2.0', id: 2, method: 'tools/list' }];
  const r = await post(lote);
  assert.equal(r.status, 200);
  assert.deepEqual((await r.json()).map((x) => x.id), [1, 2]);
  assert.equal((await post([{ jsonrpc: '2.0', method: 'notifications/initialized' }])).status, 202);
  const nuevo = await post(lote, { 'mcp-protocol-version': '2025-11-25' });
  assert.equal(nuevo.status, 400);
  assert.equal((await nuevo.json()).error.code, -32600);
});

test('cabecera MCP-Protocol-Version desconocida → 400 con las versiones admitidas', async () => {
  const r = await post({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, { 'mcp-protocol-version': '2099-01-01' });
  assert.equal(r.status, 400);
  const e = (await r.json()).error;
  assert.equal(e.code, -32022);
  assert.ok(e.data.supported.includes('2026-07-28') && e.data.supported.includes('2025-11-25'));
});

test('era moderna por HTTP: server/discover, tools/list y tools/call con cabeceras espejo', async () => {
  const d = await moderno('server/discover');
  assert.equal(d.status, 200);
  assert.equal((await d.json()).result.supportedVersions[0], '2026-07-28');
  const l = await (await moderno('tools/list')).json();
  assert.equal(l.result.resultType, 'complete');
  assert.equal(l.result.tools.length, 8);
  const args = { name: 'simular_cuota', arguments: { monto: 60000, plazoAnios: 20, programa: 'biess-credicasa' } };
  const c = await moderno('tools/call', args, { 'mcp-name': 'simular_cuota' });
  assert.equal(c.status, 200);
  assert.equal((await c.json()).result.structuredContent.cuotaMensual, 332.46);
  // Mcp-Name codificado en base64 (formato centinela de la especificación)
  const b64 = await moderno('tools/call', args, { 'mcp-name': `=?base64?${btoa('simular_cuota')}?=` });
  assert.equal(b64.status, 200);
});

test('era moderna por HTTP: códigos de estado y validación de cabeceras', async () => {
  const casos = [
    [await moderno('tools/call', { name: 'search', arguments: { query: 'biess' } }), 400, -32020], // falta Mcp-Name
    [await moderno('tools/call', { name: 'search', arguments: { query: 'biess' } }, { 'mcp-name': 'fetch' }), 400, -32020],
    [await moderno('tools/list', {}, { 'mcp-method': 'tools/call' }), 400, -32020],
    [await moderno('tools/list', {}, { 'mcp-protocol-version': '2025-11-25' }), 400, -32020],
    [await post({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: { _meta: META } }, { 'mcp-protocol-version': '2026-07-28' }), 400, -32020], // falta Mcp-Method
    [await post({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: { _meta: META } }), 400, -32020], // falta MCP-Protocol-Version
    [await post({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, { 'mcp-protocol-version': '2026-07-28', 'mcp-method': 'tools/list' }), 400, -32602], // falta _meta
    [await moderno('ping'), 404, -32601],
    [await moderno('initialize'), 404, -32601],
    [await moderno('tools/call', { name: 'nada' }, { 'mcp-name': 'nada' }), 400, -32602],
    [await post({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: { _meta: { ...META, 'io.modelcontextprotocol/protocolVersion': '2099-01-01' } } }, { 'mcp-protocol-version': '2099-01-01', 'mcp-method': 'tools/list' }), 400, -32022],
  ];
  for (const [i, [r, estado, codigo]] of casos.entries()) {
    assert.equal(r.status, estado, `caso ${i}`);
    const cuerpo = await r.json();
    assert.equal(cuerpo.error.code, codigo, `caso ${i}`);
    assert.equal(cuerpo.id, 1);
  }
});

test('origenesPermitidos: rechaza con 403 un Origin ajeno (protección contra DNS rebinding al autoalojar)', async () => {
  const local = crearManejadorHttp({ ...datos, origenesPermitidos: ['http://localhost:3333'] });
  const pedir = (origin) => local(new Request('http://localhost:3333/mcp', { method: 'POST', headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }) }));
  assert.equal((await pedir('https://malicioso.example')).status, 403);
  assert.equal((await pedir('http://localhost:3333')).status, 200);
  assert.equal((await pedir()).status, 200);
});
