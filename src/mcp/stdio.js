/**
 * Transporte stdio para el servidor MCP: un mensaje JSON-RPC por línea en stdin, una respuesta por línea en stdout.
 * Por stdout solo salen mensajes MCP; los registros van a stderr. No importa node:* (los flujos se inyectan).
 */
import { crearServidorMcp, errorJsonRpc, CODIGOS } from './servidor.js';

/**
 * Conecta el servidor a un par de flujos tipo Node (por defecto process.stdin / process.stdout).
 * @param {object} opciones
 * @param {any[]} opciones.programas
 * @param {any[]} opciones.entidades
 * @param {string} [opciones.version]
 * @param {{on: Function, setEncoding?: Function}} [opciones.entrada]
 * @param {{write: Function, on?: Function}} [opciones.salida]
 * @param {(msg: string) => void} [opciones.log] Registro de diagnóstico (stderr).
 * @returns {Promise<void>} Se resuelve cuando se cierra la entrada.
 */
export function iniciarStdio({ programas, entidades, version, entrada = globalThis.process?.stdin, salida = globalThis.process?.stdout, log = (m) => globalThis.process?.stderr?.write(`${m}\n`) } = {}) {
  const servidor = crearServidorMcp({ programas, entidades, version });
  // En la era clásica la versión se negocia una vez por proceso (initialize); en la moderna viene en cada petición.
  let versionSesion;
  let pendiente = '';

  const escribir = (obj) => salida.write(`${JSON.stringify(obj)}\n`);

  function procesarLinea(linea) {
    const texto = linea.trim();
    if (!texto) return;
    let mensaje;
    try {
      mensaje = JSON.parse(texto);
    } catch {
      escribir(errorJsonRpc(null, CODIGOS.JSON_INVALIDO, 'Parse error: cada línea debe ser un mensaje JSON-RPC válido.'));
      return;
    }
    let respuesta;
    try {
      respuesta = servidor.manejar(mensaje, { versionProtocolo: versionSesion });
    } catch (e) {
      log(`[mcp] error interno: ${e?.stack ?? e}`);
      respuesta = errorJsonRpc(mensaje?.id ?? null, CODIGOS.ERROR_INTERNO, 'Internal error');
    }
    if (respuesta === null) return;
    for (const r of Array.isArray(respuesta) ? respuesta : [respuesta]) {
      if (typeof r?.result?.protocolVersion === 'string') versionSesion = r.result.protocolVersion;
    }
    escribir(respuesta);
  }

  return new Promise((resolver) => {
    entrada.setEncoding?.('utf8');
    entrada.on('data', (trozo) => {
      pendiente += typeof trozo === 'string' ? trozo : new TextDecoder().decode(trozo);
      let corte;
      while ((corte = pendiente.indexOf('\n')) !== -1) {
        const linea = pendiente.slice(0, corte);
        pendiente = pendiente.slice(corte + 1);
        procesarLinea(linea);
      }
    });
    entrada.on('end', () => {
      if (pendiente.trim()) procesarLinea(pendiente);
      pendiente = '';
      resolver();
    });
    entrada.on('error', (e) => { log(`[mcp] error de entrada: ${e?.message ?? e}`); resolver(); });
    // El cliente cerró la tubería: terminamos sin ruido.
    salida.on?.('error', () => resolver());
  });
}
