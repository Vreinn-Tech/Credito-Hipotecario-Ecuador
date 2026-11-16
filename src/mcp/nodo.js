/**
 * Adaptador para Node: sirve el manejador HTTP del servidor MCP con node:http (para autoalojarlo o probarlo en local).
 * Solo Node; en Workers/Pages usa crearManejadorHttp directamente.
 */
import { createServer } from 'node:http';
import { crearManejadorHttp } from './http.js';

/** Tope de lectura del cuerpo; el manejador HTTP aplica después su propio límite (maxBytes). */
const MAX_CUERPO = 1024 * 1024;

/** Lee el cuerpo completo en memoria (compatible con Node 18, que no tiene ReadableStream.from). */
async function leerCuerpo(req) {
  const trozos = [];
  let total = 0;
  for await (const trozo of req) {
    total += trozo.length;
    if (total > MAX_CUERPO) break;
    trozos.push(trozo);
  }
  return Buffer.concat(trozos);
}

/**
 * Convierte un manejador (Request) => Response en un listener de node:http.
 * @param {(request: Request) => Promise<Response>} manejador
 */
export function aListenerNode(manejador) {
  return async (req, res) => {
    try {
      const conCuerpo = req.method !== 'GET' && req.method !== 'HEAD';
      const cabeceras = new Headers();
      for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) cabeceras.set(k, Array.isArray(v) ? v.join(', ') : v);
      const request = new Request(`http://${req.headers.host ?? 'localhost'}${req.url}`, {
        method: req.method,
        headers: cabeceras,
        ...(conCuerpo ? { body: await leerCuerpo(req) } : {}),
      });
      const response = await manejador(request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(response.body ? Buffer.from(await response.arrayBuffer()) : undefined);
    } catch (e) {
      process.stderr.write(`[mcp] error HTTP: ${e?.stack ?? e}\n`);
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' });
      res.end('{"jsonrpc":"2.0","id":null,"error":{"code":-32603,"message":"Internal error"}}');
    }
  };
}

/**
 * Levanta un servidor HTTP local con el endpoint MCP en /mcp.
 * @param {object} opciones Las de crearManejadorHttp más:
 * @param {number} [opciones.puerto] Por defecto 3333 (0 = puerto libre).
 * @param {string} [opciones.host] Por defecto 127.0.0.1 (solo esta máquina).
 * @returns {Promise<{servidor: import('node:http').Server, url: string, cerrar: () => Promise<void>}>}
 */
export function escucharHttp({ puerto = 3333, host = '127.0.0.1', ...opciones } = {}) {
  const manejador = crearManejadorHttp(opciones);
  const escucha = aListenerNode(manejador);
  const servidor = createServer((req, res) => {
    const ruta = (req.url ?? '/').split('?')[0];
    if (ruta === '/mcp' || ruta === '/mcp/') return escucha(req, res);
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end('{"error":"No encontrado. El endpoint MCP está en /mcp"}');
  });
  return new Promise((resolver, rechazar) => {
    servidor.once('error', rechazar);
    servidor.listen(puerto, host, () => {
      const { port } = servidor.address();
      resolver({ servidor, url: `http://${host}:${port}/mcp`, cerrar: () => new Promise((r) => servidor.close(() => r())) });
    });
  });
}
