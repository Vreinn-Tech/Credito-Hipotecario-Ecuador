/**
 * Transporte Streamable HTTP sin estado para el servidor MCP, con APIs web estándar (Request/Response):
 * funciona en Cloudflare Workers / Pages Functions, Deno, Bun y Node ≥ 18.
 *
 *  - POST con un mensaje JSON-RPC → respuesta application/json (202 sin cuerpo para notificaciones).
 *  - GET  → 405 (no hay stream servidor→cliente); a un navegador (Accept: text/html) le muestra una página informativa.
 *  - OPTIONS → CORS abierto. DELETE y el resto → 405. Sin sesiones ni autenticación: datos públicos de solo lectura.
 *
 * Atiende clientes de la era moderna (2026-07-28: valida las cabeceras MCP-Protocol-Version, Mcp-Method y Mcp-Name contra el cuerpo)
 * y de la clásica (initialize; ignora Mcp-Session-Id y Last-Event-ID).
 */
import { crearServidorMcp, errorJsonRpc, CODIGOS, VERSION_MODERNA, VERSIONES_SOPORTADAS, META_VERSION } from './servidor.js';
import { SITIO, URL_EVALUACION, AVISO } from './herramientas.js';

export const URL_DOCUMENTACION = 'https://github.com/Vreinn-Tech/Credito-Hipotecario-Ecuador/blob/main/docs/mcp.md';
export const URL_MCP_PUBLICA = `${SITIO}/mcp`;

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, GET, OPTIONS',
  'access-control-allow-headers': 'content-type, accept, authorization, mcp-protocol-version, mcp-session-id, mcp-method, mcp-name, last-event-id',
  'access-control-expose-headers': 'mcp-protocol-version',
  'access-control-max-age': '86400',
};
const BASE = { ...CORS, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };

const json = (cuerpo, status = 200, extra = {}) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...BASE, 'content-type': 'application/json; charset=utf-8', ...extra } });

/** Decodifica el formato centinela "=?base64?…?=" que la especificación permite en Mcp-Name. */
function decodificarCabecera(valor) {
  const m = /^=\?base64\?(.*)\?=$/.exec(valor);
  if (!m) return valor;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}

/** Lee el cuerpo con tope de tamaño (aunque no venga Content-Length). Devuelve null si lo supera. */
async function leerCuerpo(request, maxBytes) {
  const declarado = Number(request.headers.get('content-length'));
  if (Number.isFinite(declarado) && declarado > maxBytes) return null;
  if (!request.body) return '';
  const lector = request.body.getReader();
  const trozos = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await lector.cancel().catch(() => {});
      return null;
    }
    trozos.push(value);
  }
  const todo = new Uint8Array(total);
  let pos = 0;
  for (const t of trozos) { todo.set(t, pos); pos += t.byteLength; }
  return new TextDecoder().decode(todo);
}

function paginaInformativa(servidor, urlMcp) {
  const li = servidor.herramientas.map((h) => `<li><code>${h}</code></li>`).join('');
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Servidor MCP · Crédito Hipotecario Ecuador</title>
<style>body{font:16px/1.6 system-ui,sans-serif;max-width:42rem;margin:3rem auto;padding:0 1rem;color:#1c2733}code{background:#eef2f6;padding:.1em .35em;border-radius:4px}a{color:#0b5cab}small{color:#5a6875}</style>
</head>
<body>
<h1>Servidor MCP de Crédito Hipotecario Ecuador</h1>
<p>Esta dirección no es una página web: es un servidor <a href="https://modelcontextprotocol.io">MCP (Model Context Protocol)</a> para que asistentes como Claude o ChatGPT evalúen perfiles, simulen cuotas y consulten las condiciones de los créditos de vivienda de Ecuador.</p>
<p>Para usarlo, añade <code>${urlMcp}</code> como conector o servidor MCP remoto en tu asistente. <a href="${URL_DOCUMENTACION}">Instrucciones y documentación</a>.</p>
<p>Herramientas disponibles:</p>
<ul>${li}</ul>
<p>¿Buscas el comparador? Ve a <a href="${SITIO}/">creditohipotecarioecuador.com</a> o haz la <a href="${URL_EVALUACION}">evaluación completa y gratuita</a>.</p>
<p><small>${AVISO}</small></p>
</body>
</html>`;
}

/**
 * Crea el manejador HTTP del servidor MCP.
 * @param {object} opciones
 * @param {any[]} opciones.programas Contenido de data/programas.json.
 * @param {any[]} opciones.entidades Contenido de data/entidades.json.
 * @param {string} [opciones.version] Versión del servidor a anunciar.
 * @param {number} [opciones.maxBytes] Tamaño máximo del cuerpo (por defecto 256 KiB).
 * @param {string[]} [opciones.origenesPermitidos] Si se indica, rechaza con 403 las peticiones cuyo Origin no esté en la lista
 *   (recomendado al autoalojar en local, contra DNS rebinding). Por defecto se acepta cualquier origen: son datos públicos de solo lectura.
 * @returns {(request: Request) => Promise<Response>}
 */
export function crearManejadorHttp({ programas, entidades, version, maxBytes = 262144, origenesPermitidos } = {}) {
  const servidor = crearServidorMcp({ programas, entidades, version });

  return async function manejarHttp(request) {
    const metodo = request.method.toUpperCase();
    const origen = request.headers.get('origin');
    if (origenesPermitidos && origen && !origenesPermitidos.includes(origen)) {
      return json(errorJsonRpc(null, CODIGOS.PETICION_INVALIDA, 'Origen no permitido.'), 403);
    }
    if (metodo === 'OPTIONS') return new Response(null, { status: 204, headers: BASE });

    if (metodo !== 'POST') {
      const acepta = request.headers.get('accept') ?? '';
      const urlMcp = (() => { try { const u = new URL(request.url); return `${u.origin}${u.pathname.replace(/\/$/, '')}`; } catch { return URL_MCP_PUBLICA; } })();
      if ((metodo === 'GET' || metodo === 'HEAD') && acepta.includes('text/html') && !acepta.includes('text/event-stream')) {
        return new Response(metodo === 'HEAD' ? null : paginaInformativa(servidor, urlMcp), {
          status: 200,
          headers: { ...BASE, 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex' },
        });
      }
      const info = {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32000,
          message: 'Method Not Allowed: este es un servidor MCP (Streamable HTTP sin estado). Envía mensajes JSON-RPC con POST; no ofrece stream SSE por GET ni sesiones.',
          data: { servidor: servidor.info, versionesDeProtocolo: VERSIONES_SOPORTADAS, herramientas: servidor.herramientas, documentacion: URL_DOCUMENTACION, sitio: `${SITIO}/` },
        },
      };
      return new Response(metodo === 'HEAD' ? null : JSON.stringify(info), {
        status: 405,
        headers: { ...BASE, allow: 'POST, OPTIONS', 'content-type': 'application/json; charset=utf-8' },
      });
    }

    const tipo = (request.headers.get('content-type') ?? '').toLowerCase();
    if (!tipo.includes('application/json')) {
      return json(errorJsonRpc(null, CODIGOS.PETICION_INVALIDA, 'Unsupported Media Type: usa Content-Type: application/json.'), 415);
    }
    let texto;
    try {
      texto = await leerCuerpo(request, maxBytes);
    } catch {
      return json(errorJsonRpc(null, CODIGOS.PETICION_INVALIDA, 'No se pudo leer el cuerpo de la petición.'), 400);
    }
    if (texto === null) return json(errorJsonRpc(null, CODIGOS.PETICION_INVALIDA, `Payload Too Large: el cuerpo supera ${maxBytes} bytes.`), 413);

    let mensaje;
    try {
      mensaje = JSON.parse(texto);
    } catch {
      return json(errorJsonRpc(null, CODIGOS.JSON_INVALIDO, 'Parse error: el cuerpo no es JSON válido.'), 400);
    }

    const cabVersion = request.headers.get('mcp-protocol-version')?.trim() || undefined;

    // Era moderna: las cabeceras reflejan el cuerpo y deben coincidir (el cuerpo manda). Solo aplica a peticiones (con id).
    const esPeticion = mensaje !== null && typeof mensaje === 'object' && !Array.isArray(mensaje) && 'id' in mensaje && typeof mensaje.method === 'string';
    const versionCuerpo = esPeticion ? mensaje.params?._meta?.[META_VERSION] : undefined;
    if (esPeticion && versionCuerpo !== undefined && VERSIONES_SOPORTADAS.includes(versionCuerpo)) {
      const fallo = (msg) => json(errorJsonRpc(mensaje.id, CODIGOS.CABECERAS_NO_COINCIDEN, `Header mismatch: ${msg}`), 400);
      if (cabVersion !== undefined && cabVersion !== versionCuerpo) {
        return fallo(`la cabecera MCP-Protocol-Version ('${cabVersion}') no coincide con la versión del cuerpo ('${versionCuerpo}').`);
      }
      if (versionCuerpo === VERSION_MODERNA) {
        if (cabVersion === undefined) return fallo('falta la cabecera MCP-Protocol-Version.');
        const cabMetodo = request.headers.get('mcp-method');
        if (cabMetodo === null) return fallo('falta la cabecera Mcp-Method.');
        if (cabMetodo.trim() !== mensaje.method) return fallo(`la cabecera Mcp-Method ('${cabMetodo}') no coincide con el método del cuerpo ('${mensaje.method}').`);
        const nombre = { 'tools/call': mensaje.params?.name, 'prompts/get': mensaje.params?.name, 'resources/read': mensaje.params?.uri }[mensaje.method];
        if (typeof nombre === 'string') {
          const cabNombre = request.headers.get('mcp-name');
          if (cabNombre === null) return fallo('falta la cabecera Mcp-Name.');
          const decodificado = decodificarCabecera(cabNombre.trim());
          if (decodificado !== nombre) return fallo(`la cabecera Mcp-Name ('${cabNombre}') no coincide con el valor del cuerpo ('${nombre}').`);
        }
      }
    }

    let salida;
    try {
      salida = servidor.manejarDetallado(mensaje, { versionProtocolo: cabVersion });
    } catch {
      return json(errorJsonRpc(null, CODIGOS.ERROR_INTERNO, 'Internal error'), 500);
    }
    const { respuesta, moderno } = salida;
    if (respuesta === null) return new Response(null, { status: 202, headers: BASE });

    // Códigos HTTP: la era moderna los exige (400/404); en la clásica los errores JSON-RPC viajan con 200.
    let status = 200;
    const codigo = Array.isArray(respuesta) ? undefined : respuesta.error?.code;
    if (codigo === CODIGOS.JSON_INVALIDO || codigo === CODIGOS.PETICION_INVALIDA) status = 400;
    else if (codigo !== undefined && moderno) status = codigo === CODIGOS.METODO_NO_ENCONTRADO ? 404 : codigo === CODIGOS.ERROR_INTERNO ? 500 : 400;
    return json(respuesta, status);
  };
}
