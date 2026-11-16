// Protocolo MCP (núcleo puro): eras clásica y moderna, herramientas, errores y notificaciones.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { crearServidorMcp, VERSIONES_SOPORTADAS, VERSION_MODERNA, NOTA, USO_ORIENTATIVO } from '../src/mcp/index.js';

const leer = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const programas = leer('programas.json');
const entidades = leer('entidades.json');
const servidor = crearServidorMcp({ programas, entidades });

const NOMBRES = ['evaluar_perfil', 'simular_cuota', 'capacidad_de_credito', 'listar_programas', 'detalle_programa', 'listar_entidades', 'search', 'fetch'];
let sig = 1;
const pedir = (method, params, ctx) => servidor.manejar({ jsonrpc: '2.0', id: sig++, method, ...(params ? { params } : {}) }, ctx);
const llamar = (name, args, ctx) => pedir('tools/call', { name, arguments: args }, ctx).result;
const META = { 'io.modelcontextprotocol/protocolVersion': VERSION_MODERNA, 'io.modelcontextprotocol/clientCapabilities': {}, 'io.modelcontextprotocol/clientInfo': { name: 'prueba', version: '1' } };
const pedirModerno = (method, params = {}) => servidor.manejar({ jsonrpc: '2.0', id: sig++, method, params: { ...params, _meta: META } });

test('initialize negocia la versión del cliente si la soporta', () => {
  for (const v of ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05']) {
    const r = pedir('initialize', { protocolVersion: v, capabilities: {}, clientInfo: { name: 'x', version: '1' } });
    assert.equal(r.result.protocolVersion, v);
    assert.deepEqual(r.result.capabilities, { tools: { listChanged: false } });
    assert.equal(r.result.serverInfo.name, 'credito-hipotecario-ecuador');
    assert.match(r.result.instructions, /evaluar_perfil/);
    assert.match(r.result.instructions, /orientativas/);
    assert.match(r.result.instructions, /no deben usarse para decidir sobre el crédito de una persona/);
  }
});

test('initialize con versión desconocida responde la última clásica soportada', () => {
  assert.equal(pedir('initialize', { protocolVersion: '1999-01-01', capabilities: {} }).result.protocolVersion, '2025-11-25');
  assert.equal(pedir('initialize', { protocolVersion: VERSION_MODERNA, capabilities: {} }).result.protocolVersion, '2025-11-25');
});

test('las notificaciones y las respuestas del cliente no generan respuesta', () => {
  assert.equal(servidor.manejar({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
  assert.equal(servidor.manejar({ jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: 1 } }), null);
  assert.equal(servidor.manejar({ jsonrpc: '2.0', method: 'notifications/inventada' }), null);
  assert.equal(servidor.manejar({ jsonrpc: '2.0', id: 9, result: {} }), null);
});

test('ping', () => {
  assert.deepEqual(pedir('ping').result, {});
});

test('tools/list: ocho herramientas con esquema estricto y anotaciones de solo lectura', () => {
  const { tools } = pedir('tools/list').result;
  assert.deepEqual(tools.map((t) => t.name), NOMBRES);
  for (const t of tools) {
    assert.match(t.name, /^[a-z_]+$/);
    assert.ok(t.description.length > 60, `${t.name}: descripción corta`);
    assert.equal(t.inputSchema.type, 'object');
    assert.equal(t.inputSchema.additionalProperties, false);
    for (const [campo, def] of Object.entries(t.inputSchema.properties)) assert.ok(def.description, `${t.name}.${campo} sin descripción`);
    for (const campo of t.inputSchema.required ?? []) assert.ok(campo in t.inputSchema.properties);
    assert.equal(t.outputSchema.type, 'object');
    assert.equal(t.annotations.readOnlyHint, true);
    assert.equal(t.annotations.destructiveHint, false);
    assert.ok(t.title);
  }
  // Las herramientas que se aplican al caso de una persona dicen que el resultado es orientativo y no sirve para decidir su crédito.
  const porNombre = Object.fromEntries(tools.map((t) => [t.name, t]));
  assert.match(USO_ORIENTATIVO, /estimación orientativa/);
  assert.match(USO_ORIENTATIVO, /no consulta buró de crédito ni datos personales/);
  assert.match(USO_ORIENTATIVO, /no es una evaluación de solvencia ni una decisión, oferta o aprobación de crédito/);
  assert.match(USO_ORIENTATIVO, /no debe usarse para decidir sobre el crédito de una persona/);
  for (const nombre of ['evaluar_perfil', 'capacidad_de_credito']) assert.ok(porNombre[nombre].description.endsWith(USO_ORIENTATIVO), nombre);
  assert.match(porNombre.simular_cuota.description, /orientativo, no una oferta ni una aprobación de crédito/);
});

test('tools/list se adapta a la versión: sin outputSchema antes de 2025-06-18 y sin anotaciones en 2024-11-05', () => {
  const v0326 = pedir('tools/list', undefined, { versionProtocolo: '2025-03-26' }).result.tools[0];
  assert.equal(v0326.outputSchema, undefined);
  assert.equal(v0326.title, undefined);
  assert.equal(v0326.annotations.readOnlyHint, true);
  const v1105 = pedir('tools/list', undefined, { versionProtocolo: '2024-11-05' }).result.tools[0];
  assert.equal(v1105.annotations, undefined);
  assert.deepEqual(Object.keys(v1105), ['name', 'description', 'inputSchema']);
});

test('tools/list rechaza cursores (no hay paginación)', () => {
  assert.equal(pedir('tools/list', { cursor: 'abc' }).error.code, -32602);
});

test('evaluar_perfil: caso del afiliado con 48 aportaciones y casa de 70.000', () => {
  const r = llamar('evaluar_perfil', { precioVivienda: 70000, ingresoMensual: 1200, afiliadoIess: true, aportaciones: 48 });
  assert.equal(r.isError, false);
  const d = r.structuredContent;
  assert.equal(d.perfil.plazoDeseado, 20);
  assert.equal(d.conteo.evaluados, programas.filter((p) => p.categoria !== 'subsidio').length);
  assert.equal(d.conteo.aptos + d.conteo.condicionales + d.conteo.noAptos, d.conteo.evaluados);
  assert.ok(d.resultados.length > 0 && d.resultados.length <= 8);
  assert.ok(d.resultados.every((x) => x.elegibilidad !== 'no_apto'));
  assert.equal(d.resultados[0].slug, 'biess-credicasa');
  for (const x of d.resultados) {
    assert.equal(x.programa, undefined, 'no debe incluir el objeto programa completo');
    assert.equal(x.url, `https://creditohipotecarioecuador.com/programas/${x.slug}/`);
    assert.match(x.fechaDato, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(x.fuenteUrl, /^https?:\/\//);
    for (const k of ['score', 'montoFinanciable', 'cuotaEstimada', 'plazo', 'entradaRequerida', 'capacidadMaxima']) assert.equal(typeof x[k], 'number', k);
    assert.equal(typeof x.verificado, 'boolean');
    assert.ok(Array.isArray(x.razones));
  }
  // ordenado de mejor a peor
  assert.deepEqual(d.resultados.map((x) => x.score), [...d.resultados.map((x) => x.score)].sort((a, b) => b - a));
  assert.equal(r.content.length, 1);
  assert.ok(r.content[0].text.endsWith(NOTA));
  assert.match(r.content[0].text, /CrediCasa/);
});

test('evaluar_perfil: incluirNoAptos y limite', () => {
  const todos = llamar('evaluar_perfil', { precioVivienda: 70000, ingresoMensual: 1200, incluirNoAptos: true, limite: 50 }).structuredContent;
  assert.equal(todos.resultados.length, todos.conteo.evaluados);
  assert.ok(todos.resultados.some((x) => x.elegibilidad === 'no_apto' && x.razones.length > 0));
  assert.equal(llamar('evaluar_perfil', { precioVivienda: 70000, ingresoMensual: 1200, limite: 2 }).structuredContent.resultados.length, 2);
});

test('evaluar_perfil: errores de validación → isError con mensaje útil, no error de protocolo', () => {
  const casos = [
    [{ ingresoMensual: 1200 }, /precioVivienda/],
    [{ precioVivienda: 70000 }, /ingresoMensual/],
    [{ precioVivienda: 70000, ingresoMensual: 1200, uso: 'yate' }, /uso/],
    [{ precioVivienda: 70000, ingresoMensual: 1200, edad: 12 }, /edad/],
    [{ precioVivienda: 70000, ingresoMensual: 1200, afiliadoIess: 'quizás' }, /afiliadoIess/],
    [{ precioVivienda: 70000, ingresoMensual: 1200, limite: 0 }, /limite/],
    [{ precioVivienda: 70000, ingresoMensual: 1200, colorFavorito: 'azul' }, /colorFavorito.*Parámetros válidos/],
  ];
  for (const [args, patron] of casos) {
    const r = llamar('evaluar_perfil', args);
    assert.equal(r.isError, true, JSON.stringify(args));
    assert.match(r.content[0].text, patron);
    assert.equal(r.structuredContent, undefined);
  }
});

test('evaluar_perfil tolera números y booleanos enviados como texto', () => {
  const r = llamar('evaluar_perfil', { precioVivienda: '70000', ingresoMensual: '1200', afiliadoIess: 'true', aportaciones: '48' });
  assert.equal(r.isError, false);
  assert.equal(r.structuredContent.perfil.afiliadoIess, true);
  assert.equal(r.structuredContent.perfil.precioVivienda, 70000);
});

test('simular_cuota: tasa explícita, total e intereses', () => {
  const d = llamar('simular_cuota', { monto: 100000, tasaNominalAnual: 12, plazoAnios: 30 }).structuredContent;
  assert.equal(d.cuotaMensual, 1028.61);
  assert.equal(d.numeroCuotas, 360);
  assert.equal(d.tasaEfectivaAnual, 12.68);
  assert.ok(Math.abs(d.totalPagado - d.cuotaMensual * 360) < 2); // el total usa la cuota sin redondear
  assert.ok(Math.abs(d.totalIntereses - (d.totalPagado - 100000)) < 0.01);
  assert.equal(d.tabla, undefined);
  assert.equal(d.resumenAnual, undefined);
  const cero = llamar('simular_cuota', { monto: 12000, tasaNominalAnual: 0, plazoAnios: 10 }).structuredContent;
  assert.equal(cero.cuotaMensual, 100);
  assert.equal(cero.totalIntereses, 0);
});

test('simular_cuota: tasa tomada del programa y tablas', () => {
  const p = programas.find((x) => x.slug === 'biess-credicasa');
  const anual = llamar('simular_cuota', { monto: 60000, plazoAnios: 20, programa: 'biess-credicasa', incluirTabla: 'anual' });
  const d = anual.structuredContent;
  assert.equal(d.tasaNominalAnual, p.tasaNominal);
  assert.equal(d.programa.slug, 'biess-credicasa');
  assert.equal(d.resumenAnual.length, 20);
  assert.equal(d.resumenAnual.at(-1).saldoFinal, 0);
  assert.ok(Math.abs(d.resumenAnual.reduce((s, f) => s + f.capitalPagado, 0) - 60000) < 0.5);
  assert.match(anual.content[0].text, /Resumen anual/);
  const mensual = llamar('simular_cuota', { monto: 60000, plazoAnios: 20, programa: 'biess-credicasa', incluirTabla: 'mensual' }).structuredContent;
  assert.equal(mensual.tabla.length, 240);
  assert.deepEqual(Object.keys(mensual.tabla[0]), ['n', 'cuota', 'interes', 'capital', 'saldo']);
  assert.equal(mensual.tabla.at(-1).saldo, 0);
});

test('simular_cuota: advertencias y errores', () => {
  const adv = llamar('simular_cuota', { monto: 90000, plazoAnios: 35, programa: 'biess-credicasa' }).structuredContent;
  assert.equal(adv.advertencias.length, 2);
  assert.match(llamar('simular_cuota', { monto: 50000, plazoAnios: 20 }).content[0].text, /tasaNominalAnual.*programa/);
  assert.equal(llamar('simular_cuota', { monto: 50000, plazoAnios: 20 }).isError, true);
  const inexistente = llamar('simular_cuota', { monto: 50000, plazoAnios: 20, programa: 'no-existe' });
  assert.equal(inexistente.isError, true);
  assert.match(inexistente.content[0].text, /biess-credicasa/);
  assert.equal(llamar('simular_cuota', { monto: 50000, plazoAnios: 20, programa: 'casa-100' }).isError, true); // subsidio sin tasa
  assert.equal(llamar('simular_cuota', { monto: -5, plazoAnios: 20, tasaNominalAnual: 8 }).isError, true);
  assert.equal(llamar('simular_cuota', { monto: 5000, plazoAnios: 0, tasaNominalAnual: 8 }).isError, true);
  assert.equal(llamar('simular_cuota', { monto: 5000, plazoAnios: 20, tasaNominalAnual: 8, incluirTabla: 'semanal' }).isError, true);
});

test('capacidad_de_credito', () => {
  const d = llamar('capacidad_de_credito', { ingresoMensual: 1200, tasaNominalAnual: 8.5, plazoAnios: 20 }).structuredContent;
  assert.equal(d.ratioCuotaIngreso, 0.35);
  assert.equal(d.cuotaMaxima, 420);
  assert.ok(Math.abs(d.montoMaximo - 48397.07) < 1, String(d.montoMaximo));
  // coherencia con simular_cuota: el monto máximo produce la cuota máxima
  const c = llamar('simular_cuota', { monto: d.montoMaximo, tasaNominalAnual: 8.5, plazoAnios: 20 }).structuredContent;
  assert.ok(Math.abs(c.cuotaMensual - 420) < 0.01);
  const conDeudas = llamar('capacidad_de_credito', { ingresoMensual: 1200, deudasMensuales: 200, tasaNominalAnual: 8.5, plazoAnios: 20, ratioCuotaIngreso: 0.4 }).structuredContent;
  assert.equal(conDeudas.ingresoDisponible, 1000);
  assert.equal(conDeudas.cuotaMaxima, 400);
  assert.equal(llamar('capacidad_de_credito', { ingresoMensual: 1200, tasaNominalAnual: 8.5 }).isError, true);
  assert.equal(llamar('capacidad_de_credito', { ingresoMensual: 1200, tasaNominalAnual: 8.5, plazoAnios: 20, ratioCuotaIngreso: 35 }).isError, true);
});

test('listar_programas: sin filtros y con filtros', () => {
  const todos = llamar('listar_programas', {}).structuredContent;
  assert.equal(todos.total, programas.length);
  assert.equal(todos.programas[0].url, `https://creditohipotecarioecuador.com/programas/${todos.programas[0].slug}/`);
  assert.equal(todos.programas[0].descripcion, undefined);
  const biess = llamar('listar_programas', { entidad: 'biess' }).structuredContent;
  assert.ok(biess.total > 0 && biess.programas.every((p) => p.entidad === 'biess'));
  const priv = llamar('listar_programas', { categoria: 'privado', uso: 'terreno', soloVerificados: true }).structuredContent;
  assert.equal(priv.total, programas.filter((p) => p.categoria === 'privado' && p.usos.includes('terreno') && p.verificado).length);
  assert.equal(llamar('listar_programas', { categoria: 'lujo' }).isError, true);
  assert.equal(llamar('listar_programas', { entidad: 'banco-inexistente' }).isError, true);
  assert.equal(pedir('tools/call', { name: 'listar_programas' }).result.structuredContent.total, programas.length); // sin "arguments"
});

test('detalle_programa', () => {
  const r = llamar('detalle_programa', { slug: 'biess-credicasa' });
  const d = r.structuredContent;
  assert.equal(d.programa.slug, 'biess-credicasa');
  assert.ok(d.programa.requisitos.length && d.programa.ventajas.length && d.programa.desventajas.length && d.programa.pasos.length);
  assert.equal(d.entidad.slug, 'biess');
  assert.equal(d.url, 'https://creditohipotecarioecuador.com/programas/biess-credicasa/');
  assert.match(r.content[0].text, /Requisitos:/);
  assert.match(r.content[0].text, /Dato del \d{4}-\d{2}-\d{2}/);
  assert.ok(llamar('detalle_programa', { slug: 'biess-vivienda-terminada' }).structuredContent.programa.tramos.length > 0);
  const malo = llamar('detalle_programa', { slug: 'nada' });
  assert.equal(malo.isError, true);
  assert.match(malo.content[0].text, /Slugs válidos/);
  assert.equal(llamar('detalle_programa', {}).isError, true);
});

test('listar_entidades: filtros por tipo y provincia', () => {
  const todas = llamar('listar_entidades', {}).structuredContent;
  assert.equal(todas.total, entidades.length);
  assert.ok(todas.entidades.find((e) => e.slug === 'biess').programas.includes('biess-credicasa'));
  const loja = llamar('listar_entidades', { tipo: 'cooperativa', provincia: 'loja' }).structuredContent;
  assert.ok(loja.total > 0);
  assert.ok(loja.entidades.every((e) => e.tipo === 'cooperativa' && (e.cobertura === 'nacional' || e.cobertura.includes('loja'))));
  assert.equal(llamar('listar_entidades', { provincia: 'El Oro' }).isError, false); // acepta el nombre
  assert.equal(llamar('listar_entidades', { provincia: 'atlantida' }).isError, true);
  assert.equal(llamar('listar_entidades', { tipo: 'fintech' }).isError, true);
});

test('search y fetch con la forma que pide ChatGPT', () => {
  const r = llamar('search', { query: 'BIESS primera vivienda' });
  assert.deepEqual(Object.keys(r.structuredContent), ['results']);
  assert.ok(r.structuredContent.results.length > 0);
  for (const x of r.structuredContent.results) {
    assert.deepEqual(Object.keys(x), ['id', 'title', 'url']);
    assert.match(x.url, /^https:\/\//);
  }
  assert.match(r.structuredContent.results[0].id, /biess/);
  assert.deepEqual(JSON.parse(r.content[0].text), r.structuredContent); // mismo valor como JSON en content
  assert.equal(r.content.at(-1).text, NOTA);
  assert.deepEqual(llamar('search', { query: 'xyzzy inexistente' }).structuredContent.results, []);
  assert.equal(llamar('search', {}).isError, true);

  // todo lo que devuelve search se puede leer con fetch
  for (const { id } of llamar('search', { query: 'cooperativa hipotecario Loja' }).structuredContent.results) {
    const f = llamar('fetch', { id });
    assert.equal(f.isError, false, id);
    const doc = f.structuredContent;
    assert.equal(doc.id, id);
    assert.ok(doc.title && doc.text.length > 100 && doc.url.startsWith('https://'));
    assert.ok(doc.text.endsWith(NOTA));
    assert.deepEqual(JSON.parse(f.content[0].text), doc);
  }
  assert.equal(llamar('fetch', { id: 'programa:biess-credicasa' }).structuredContent.metadata.tipo, 'programa');
  assert.equal(llamar('fetch', { id: 'entidad:jep' }).structuredContent.metadata.tipo, 'entidad');
  assert.equal(llamar('fetch', { id: 'programa:no-existe' }).isError, true);
});

test('todas las respuestas de herramientas terminan con la nota legal y la fuente', () => {
  const llamadas = {
    evaluar_perfil: { precioVivienda: 70000, ingresoMensual: 1200 },
    simular_cuota: { monto: 50000, tasaNominalAnual: 9, plazoAnios: 15 },
    capacidad_de_credito: { ingresoMensual: 1500, tasaNominalAnual: 9, plazoAnios: 15 },
    listar_programas: {},
    detalle_programa: { slug: 'miti-miti-vip' },
    listar_entidades: {},
    search: { query: 'vip' },
    fetch: { id: 'programa:miti-miti-vip' },
  };
  assert.deepEqual(Object.keys(llamadas), NOMBRES);
  for (const [nombre, args] of Object.entries(llamadas)) {
    const r = llamar(nombre, args);
    assert.equal(r.isError, false, nombre);
    const ultimo = r.content.at(-1).text;
    const texto = nombre === 'fetch' ? r.structuredContent.text : ultimo;
    assert.ok(texto.endsWith(NOTA), nombre);
    assert.match(NOTA, /orientativo/);
    assert.match(NOTA, /no es una oferta ni una aprobación de crédito, ni asesoría financiera/);
    assert.match(NOTA, /creditohipotecarioecuador\.com/);
    assert.match(NOTA, /https:\/\/creditohipotecarioecuador\.com\/evaluacion\//);
    assert.match(NOTA, /fechaDato/);
  }
});

test('sin structuredContent en versiones anteriores a 2025-06-18: el JSON va en un segundo bloque de texto', () => {
  const r = llamar('capacidad_de_credito', { ingresoMensual: 1200, tasaNominalAnual: 8.5, plazoAnios: 20 }, { versionProtocolo: '2025-03-26' });
  assert.equal(r.structuredContent, undefined);
  assert.equal(r.content.length, 2);
  assert.equal(JSON.parse(r.content[1].text).cuotaMaxima, 420);
});

test('errores de protocolo: -32601, -32602, -32600', () => {
  assert.equal(pedir('resources/list').error.code, -32601);
  assert.equal(pedir('metodo/inventado').error.code, -32601);
  const desconocida = pedir('tools/call', { name: 'borrar_todo', arguments: {} });
  assert.equal(desconocida.error.code, -32602);
  assert.match(desconocida.error.message, /Unknown tool: borrar_todo/);
  assert.equal(pedir('tools/call', {}).error.code, -32602);
  assert.equal(pedir('tools/call', { name: 'search', arguments: 'hola' }).error.code, -32602);
  assert.equal(servidor.manejar({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: [1, 2] }).error.code, -32602);
  for (const malo of [null, 7, 'hola', {}, { jsonrpc: '1.0', id: 1, method: 'ping' }, { jsonrpc: '2.0', id: 1 }, { jsonrpc: '2.0', id: null, method: 'ping' }, { jsonrpc: '2.0', id: {}, method: 'ping' }]) {
    const r = servidor.manejar(malo);
    assert.equal(r.error.code, -32600, JSON.stringify(malo));
  }
  // el id se conserva en los errores
  assert.equal(servidor.manejar({ jsonrpc: '2.0', id: 'abc', method: 'nada' }).id, 'abc');
});

test('lotes: admitidos sin versión negociada o con 2025-03-26; rechazados desde 2025-06-18', () => {
  const lote = [
    { jsonrpc: '2.0', id: 1, method: 'ping' },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    { jsonrpc: '2.0', id: 3, method: 'nada' },
  ];
  for (const ctx of [undefined, { versionProtocolo: '2025-03-26' }, { versionProtocolo: '2024-11-05' }]) {
    const r = servidor.manejar(lote, ctx);
    assert.equal(r.length, 3);
    assert.deepEqual(r.map((x) => x.id), [1, 2, 3]);
    assert.equal(r[2].error.code, -32601);
  }
  assert.equal(servidor.manejar([{ jsonrpc: '2.0', method: 'notifications/initialized' }]), null);
  assert.equal(servidor.manejar([]).error.code, -32600);
  assert.equal(servidor.manejar(lote, { versionProtocolo: '2025-06-18' }).error.code, -32600);
  assert.equal(servidor.manejar(lote, { versionProtocolo: '2025-11-25' }).error.code, -32600);
});

test('era moderna (2026-07-28): server/discover', () => {
  const r = pedirModerno('server/discover').result;
  assert.equal(r.resultType, 'complete');
  assert.deepEqual(r.supportedVersions, VERSIONES_SOPORTADAS);
  assert.equal(r.supportedVersions[0], '2026-07-28');
  assert.ok(r.capabilities.tools);
  assert.equal(r._meta['io.modelcontextprotocol/serverInfo'].name, 'credito-hipotecario-ecuador');
  assert.ok(r.instructions);
  assert.ok(r.ttlMs >= 0);
  assert.equal(r.cacheScope, 'public');
});

test('era moderna: tools/list y tools/call sin handshake, con resultType e identidad del servidor', () => {
  const lista = pedirModerno('tools/list').result;
  assert.equal(lista.resultType, 'complete');
  assert.equal(lista.tools.length, 8);
  assert.equal(lista.cacheScope, 'public');
  assert.equal(typeof lista.ttlMs, 'number');
  assert.ok(lista.tools[0].outputSchema);
  const r = pedirModerno('tools/call', { name: 'capacidad_de_credito', arguments: { ingresoMensual: 1200, tasaNominalAnual: 8.5, plazoAnios: 20 } }).result;
  assert.equal(r.resultType, 'complete');
  assert.equal(r.structuredContent.cuotaMaxima, 420);
  assert.equal(r._meta['io.modelcontextprotocol/serverInfo'].version, servidor.info.version);
  const err = pedirModerno('tools/call', { name: 'capacidad_de_credito', arguments: {} }).result;
  assert.equal(err.isError, true);
  assert.equal(err.resultType, 'complete');
});

test('era moderna: errores de versión, metadatos y métodos retirados', () => {
  const sinVersion = servidor.manejar({ jsonrpc: '2.0', id: 1, method: 'server/discover' });
  assert.equal(sinVersion.error.code, -32602);
  const sinCapacidades = servidor.manejar({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: { _meta: { 'io.modelcontextprotocol/protocolVersion': VERSION_MODERNA } } });
  assert.equal(sinCapacidades.error.code, -32602);
  const futura = servidor.manejar({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: { _meta: { ...META, 'io.modelcontextprotocol/protocolVersion': '2099-01-01' } } });
  assert.equal(futura.error.code, -32022);
  assert.deepEqual(futura.error.data, { supported: VERSIONES_SOPORTADAS, requested: '2099-01-01' });
  assert.equal(pedirModerno('ping').error.code, -32601);
  assert.equal(pedirModerno('initialize').error.code, -32601);
  assert.match(pedirModerno('initialize').error.message, /2026-07-28/);
  assert.equal(pedirModerno('subscriptions/listen').error.code, -32601);
  assert.equal(pedirModerno('tools/call', { name: 'nada' }).error.code, -32602);
  // los lotes no existen en la era moderna
  assert.equal(servidor.manejar([{ jsonrpc: '2.0', id: 1, method: 'tools/list', params: { _meta: META } }]).error.code, -32600);
  // la versión por contexto (cabecera HTTP) desconocida también se rechaza con -32022
  assert.equal(servidor.manejar({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, { versionProtocolo: '2099-01-01' }).error.code, -32022);
});

test('manejar es puro: mismos datos de entrada, misma salida, sin estado entre llamadas', () => {
  const m = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'evaluar_perfil', arguments: { precioVivienda: 90000, ingresoMensual: 2000 } } };
  assert.deepEqual(servidor.manejar(m), servidor.manejar(structuredClone(m)));
  // tools/call funciona sin initialize previo (HTTP sin estado)
  const nuevo = crearServidorMcp({ programas, entidades });
  assert.equal(nuevo.manejar(m).result.isError, false);
  assert.throws(() => crearServidorMcp({}), /programas, entidades/);
});

test('las salidas estructuradas cumplen su outputSchema (campos requeridos y tipos básicos)', () => {
  const { tools } = pedir('tools/list').result;
  const ejemplos = {
    evaluar_perfil: { precioVivienda: 70000, ingresoMensual: 1200, incluirNoAptos: true, limite: 50 },
    simular_cuota: { monto: 50000, programa: 'biess-credicasa', plazoAnios: 15, incluirTabla: 'mensual' },
    capacidad_de_credito: { ingresoMensual: 1500, tasaNominalAnual: 9, plazoAnios: 15 },
    listar_programas: {},
    detalle_programa: { slug: 'casa-100' },
    listar_entidades: {},
    search: { query: 'banco' },
    fetch: { id: 'entidad:biess' },
  };
  const tipoDe = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v);
  const validar = (esquema, valor, ruta) => {
    if (esquema.anyOf) return assert.ok(esquema.anyOf.some((s) => { try { validar(s, valor, ruta); return true; } catch { return false; } }), ruta);
    if (esquema.type) {
      const tipos = [].concat(esquema.type);
      const t = tipoDe(valor);
      assert.ok(tipos.includes(t) || (t === 'integer' && tipos.includes('number')), `${ruta}: se esperaba ${tipos} y llegó ${t}`);
    }
    if (esquema.enum) assert.ok(esquema.enum.includes(valor), `${ruta}: ${valor} fuera del enum`);
    if (tipoDe(valor) === 'object') {
      for (const r of esquema.required ?? []) assert.ok(r in valor, `${ruta}.${r} requerido`);
      for (const [k, s] of Object.entries(esquema.properties ?? {})) if (k in valor) validar(s, valor[k], `${ruta}.${k}`);
    }
    if (tipoDe(valor) === 'array' && esquema.items) valor.forEach((x, i) => validar(esquema.items, x, `${ruta}[${i}]`));
  };
  for (const t of tools) validar(t.outputSchema, llamar(t.name, ejemplos[t.name]).structuredContent, t.name);
});

test('lotes: más de 10 mensajes se rechazan para no multiplicar el cálculo', () => {
  const lote = Array.from({ length: 11 }, (_, i) => ({ jsonrpc: '2.0', id: i + 1, method: 'ping' }));
  assert.equal(servidor.manejar(lote).error.code, -32600);
  assert.equal(servidor.manejar(lote.slice(0, 10)).length, 10);
});
