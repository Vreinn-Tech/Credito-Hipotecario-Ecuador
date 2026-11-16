/**
 * Servidor MCP (Model Context Protocol) sin dependencias: solo herramientas, solo lectura.
 * Núcleo PURO (sin node:*, sin fetch, sin estado): recibe un mensaje JSON-RPC 2.0 y devuelve la respuesta.
 * Sirve igual en Node (stdio, node:http) y en Workers/Pages Functions (ver ./http.js y ./stdio.js).
 *
 * Habla las dos "eras" del protocolo:
 *  - Moderna (2026-07-28): sin handshake; cada petición trae versión y capacidades del cliente en params._meta
 *    ("io.modelcontextprotocol/protocolVersion", ".../clientCapabilities"); existe server/discover; los resultados llevan resultType.
 *  - Clásica (2025-11-25, 2025-06-18, 2025-03-26, 2024-11-05): initialize + notifications/initialized, ping, tools/list, tools/call.
 * Especificación: https://modelcontextprotocol.io/specification/2026-07-28 (verificada el 2026-11-15).
 */
import { crearHerramientas, ErrorDeHerramienta, NOTA, SITIO } from './herramientas.js';

export const NOMBRE_SERVIDOR = 'credito-hipotecario-ecuador';
export const VERSION_SERVIDOR = '0.1.1';
export const VERSION_MODERNA = '2026-07-28';
export const VERSIONES_CLASICAS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
/** Versiones de protocolo admitidas, de la más nueva a la más antigua. */
export const VERSIONES_SOPORTADAS = [VERSION_MODERNA, ...VERSIONES_CLASICAS];

export const META_VERSION = 'io.modelcontextprotocol/protocolVersion';
export const META_CAPACIDADES = 'io.modelcontextprotocol/clientCapabilities';
export const META_SERVIDOR = 'io.modelcontextprotocol/serverInfo';

export const CODIGOS = {
  JSON_INVALIDO: -32700,
  PETICION_INVALIDA: -32600,
  METODO_NO_ENCONTRADO: -32601,
  PARAMETROS_INVALIDOS: -32602,
  ERROR_INTERNO: -32603,
  CABECERAS_NO_COINCIDEN: -32020,
  VERSION_NO_SOPORTADA: -32022,
};

export const INSTRUCCIONES =
  'Servidor de crédito hipotecario y de vivienda en Ecuador (BIESS, tasa preferencial VIS/VIP "Miti-Miti", bancos, cooperativas y mutualistas), con datos de creditohipotecarioecuador.com. ' +
  'Usa evaluar_perfil para saber a qué créditos califica una persona; simular_cuota y capacidad_de_credito para cálculos; listar_programas, detalle_programa y listar_entidades para consultar condiciones; ' +
  'search y fetch para investigación por palabras clave. Montos en USD, tasas en % nominal anual, plazos en años. ' +
  'Los datos son referenciales y tienen fecha (fechaDato): no son una oferta de crédito ni asesoría financiera; indica siempre la fecha del dato y recomienda verificar con la entidad. ' +
  `Para la evaluación completa remite a ${SITIO}/evaluacion/. Responde en español salvo que el usuario escriba en otro idioma.`;

const esObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const idValido = (id) => typeof id === 'string' || (typeof id === 'number' && Number.isFinite(id));

/** Construye una respuesta de error JSON-RPC. */
export function errorJsonRpc(id, code, message, data) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message, ...(data === undefined ? {} : { data }) } };
}

/**
 * @param {{programas: any[], entidades: any[], version?: string}} opciones Datos inyectados (data/programas.json y data/entidades.json) y versión a anunciar.
 */
export function crearServidorMcp({ programas, entidades, version = VERSION_SERVIDOR } = {}) {
  const herramientas = crearHerramientas({ programas, entidades });
  const infoServidor = { name: NOMBRE_SERVIDOR, title: 'Crédito Hipotecario Ecuador', version, websiteUrl: SITIO };
  const capacidades = { tools: { listChanged: false } };

  /** Definición de cada herramienta según lo que admite la versión de protocolo (undefined = sin negociar: todo). */
  function definiciones(versionProtocolo) {
    const v = versionProtocolo ?? VERSION_MODERNA;
    return herramientas.lista.map((h) => ({
      name: h.name,
      ...(v >= '2025-06-18' ? { title: h.title } : {}),
      description: h.description,
      inputSchema: h.inputSchema,
      ...(v >= '2025-06-18' ? { outputSchema: h.outputSchema } : {}),
      ...(v >= '2025-03-26' ? { annotations: h.annotations } : {}),
    }));
  }

  function llamarHerramienta(params, versionProtocolo) {
    const estructurado = (versionProtocolo ?? VERSION_MODERNA) >= '2025-06-18';
    try {
      const r = herramientas.ejecutar(params.name, params.arguments ?? {});
      const content = r.crudo
        ? [{ type: 'text', text: JSON.stringify(r.datos) }, { type: 'text', text: NOTA }]
        : [{ type: 'text', text: `${r.texto}\n\n${NOTA}` }, ...(estructurado ? [] : [{ type: 'text', text: JSON.stringify(r.datos) }])];
      return { content, ...(estructurado ? { structuredContent: r.datos } : {}), isError: false };
    } catch (e) {
      if (!(e instanceof ErrorDeHerramienta)) throw e;
      return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
    }
  }

  /** Métodos comunes a las dos eras. Devuelve el `result` o lanza { code, message }. */
  function despachar(metodo, params, versionProtocolo) {
    if (metodo === 'tools/list') {
      if (params.cursor !== undefined && params.cursor !== null && params.cursor !== '') {
        throw { code: CODIGOS.PARAMETROS_INVALIDOS, message: 'Cursor no válido: la lista de herramientas no está paginada.' };
      }
      return { tools: definiciones(versionProtocolo) };
    }
    if (metodo === 'tools/call') {
      if (typeof params.name !== 'string') throw { code: CODIGOS.PARAMETROS_INVALIDOS, message: 'Falta "name" (nombre de la herramienta) en params.' };
      if (!herramientas.existe(params.name)) {
        throw { code: CODIGOS.PARAMETROS_INVALIDOS, message: `Unknown tool: ${params.name}. Herramientas disponibles: ${herramientas.lista.map((h) => h.name).join(', ')}.` };
      }
      if (params.arguments !== undefined && params.arguments !== null && !esObjeto(params.arguments)) {
        throw { code: CODIGOS.PARAMETROS_INVALIDOS, message: '"arguments" debe ser un objeto JSON.' };
      }
      return llamarHerramienta(params, versionProtocolo);
    }
    throw { code: CODIGOS.METODO_NO_ENCONTRADO, message: `Method not found: ${metodo}` };
  }

  function uno(mensaje, ctx) {
    if (!esObjeto(mensaje) || mensaje.jsonrpc !== '2.0') {
      return { respuesta: errorJsonRpc(esObjeto(mensaje) && idValido(mensaje.id) ? mensaje.id : null, CODIGOS.PETICION_INVALIDA, 'Invalid Request: se esperaba un mensaje JSON-RPC 2.0.'), moderno: false };
    }
    // Respuestas del cliente (no las pedimos nunca) y notificaciones: sin respuesta.
    if (mensaje.method === undefined && ('result' in mensaje || 'error' in mensaje)) return { respuesta: null, moderno: false };
    if (typeof mensaje.method !== 'string') {
      return { respuesta: errorJsonRpc(idValido(mensaje.id) ? mensaje.id : null, CODIGOS.PETICION_INVALIDA, 'Invalid Request: falta "method".'), moderno: false };
    }
    if (!('id' in mensaje)) return { respuesta: null, moderno: false };
    const { id, method } = mensaje;
    if (!idValido(id)) return { respuesta: errorJsonRpc(null, CODIGOS.PETICION_INVALIDA, 'Invalid Request: "id" debe ser un texto o un número.'), moderno: false };
    if (mensaje.params !== undefined && !esObjeto(mensaje.params)) {
      return { respuesta: errorJsonRpc(id, CODIGOS.PARAMETROS_INVALIDOS, 'Invalid params: "params" debe ser un objeto.'), moderno: false };
    }
    const params = mensaje.params ?? {};
    const meta = esObjeto(params._meta) ? params._meta : {};
    const declarada = meta[META_VERSION];

    const noSoportada = (pedida) =>
      errorJsonRpc(id, CODIGOS.VERSION_NO_SOPORTADA, `Unsupported protocol version. Versiones admitidas: ${VERSIONES_SOPORTADAS.join(', ')}.`, { supported: VERSIONES_SOPORTADAS, requested: pedida });

    if (declarada !== undefined && !VERSIONES_SOPORTADAS.includes(declarada)) return { respuesta: noSoportada(declarada), moderno: true };
    if (declarada === undefined && ctx.versionProtocolo !== undefined && !VERSIONES_SOPORTADAS.includes(ctx.versionProtocolo)) {
      return { respuesta: noSoportada(ctx.versionProtocolo), moderno: true };
    }

    const moderno = declarada === VERSION_MODERNA || (declarada === undefined && (method === 'server/discover' || ctx.versionProtocolo === VERSION_MODERNA));
    try {
      if (moderno) {
        if (declarada === undefined || !esObjeto(meta[META_CAPACIDADES])) {
          throw { code: CODIGOS.PARAMETROS_INVALIDOS, message: `Invalid params: toda petición ${VERSION_MODERNA} debe incluir params._meta["${META_VERSION}"] y params._meta["${META_CAPACIDADES}"].` };
        }
        const sello = { resultType: 'complete', _meta: { [META_SERVIDOR]: infoServidor } };
        if (method === 'server/discover') {
          return { respuesta: { jsonrpc: '2.0', id, result: { ...sello, supportedVersions: VERSIONES_SOPORTADAS, capabilities: capacidades, instructions: INSTRUCCIONES, ttlMs: 3600000, cacheScope: 'public' } }, moderno };
        }
        if (method === 'initialize' || method === 'ping') {
          throw { code: CODIGOS.METODO_NO_ENCONTRADO, message: `Method not found: ${method} no existe en ${VERSION_MODERNA} (usa server/discover). Versiones admitidas: ${VERSIONES_SOPORTADAS.join(', ')}.` };
        }
        const result = despachar(method, params, VERSION_MODERNA);
        return { respuesta: { jsonrpc: '2.0', id, result: { ...sello, ...result, ...(method === 'tools/list' ? { ttlMs: 3600000, cacheScope: 'public' } : {}) } }, moderno };
      }

      // Era clásica (con handshake). No guardamos estado: la versión llega por contexto (cabecera HTTP o sesión stdio).
      const versionClasica = declarada ?? ctx.versionProtocolo;
      if (method === 'initialize') {
        const pedida = params.protocolVersion;
        const negociada = VERSIONES_CLASICAS.includes(pedida) ? pedida : VERSIONES_CLASICAS[0];
        return { respuesta: { jsonrpc: '2.0', id, result: { protocolVersion: negociada, capabilities: capacidades, serverInfo: infoServidor, instructions: INSTRUCCIONES } }, moderno };
      }
      if (method === 'ping') return { respuesta: { jsonrpc: '2.0', id, result: {} }, moderno };
      return { respuesta: { jsonrpc: '2.0', id, result: despachar(method, params, versionClasica) }, moderno };
    } catch (e) {
      if (e && typeof e.code === 'number' && !(e instanceof Error)) return { respuesta: errorJsonRpc(id, e.code, e.message, e.data), moderno };
      return { respuesta: errorJsonRpc(id, CODIGOS.ERROR_INTERNO, 'Internal error'), moderno };
    }
  }

  /** Tope de mensajes por lote: evita que una sola petición dispare cientos de cálculos. */
  const MAX_LOTE = 10;

  /**
   * Procesa un mensaje (o un lote, solo en versiones que lo admiten: 2025-03-26 y anteriores) e indica la era con que se atendió.
   * @param {unknown} mensaje Mensaje JSON-RPC ya parseado.
   * @param {{versionProtocolo?: string}} [ctx] Versión negociada fuera del mensaje (cabecera MCP-Protocol-Version o sesión stdio).
   * @returns {{respuesta: object | object[] | null, moderno: boolean}} `respuesta` es null si no hay que contestar (notificaciones).
   */
  function manejarDetallado(mensaje, ctx = {}) {
    if (Array.isArray(mensaje)) {
      const v = ctx.versionProtocolo;
      const hayModerno = mensaje.some((m) => esObjeto(m) && esObjeto(m.params) && esObjeto(m.params._meta) && m.params._meta[META_VERSION] !== undefined);
      if (mensaje.length === 0 || hayModerno || (v !== undefined && v >= '2025-06-18')) {
        const motivo = mensaje.length === 0 ? 'lote vacío' : 'los lotes JSON-RPC solo se admiten con las versiones de protocolo 2025-03-26 y 2024-11-05';
        return { respuesta: errorJsonRpc(null, CODIGOS.PETICION_INVALIDA, `Invalid Request: ${motivo}.`), moderno: false };
      }
      if (mensaje.length > MAX_LOTE) {
        return { respuesta: errorJsonRpc(null, CODIGOS.PETICION_INVALIDA, `Invalid Request: un lote admite como máximo ${MAX_LOTE} mensajes.`), moderno: false };
      }
      const respuestas = mensaje.map((m) => uno(m, ctx).respuesta).filter((r) => r !== null);
      return { respuesta: respuestas.length ? respuestas : null, moderno: false };
    }
    return uno(mensaje, ctx);
  }

  return {
    info: infoServidor,
    versiones: VERSIONES_SOPORTADAS,
    herramientas: herramientas.lista.map((h) => h.name),
    manejarDetallado,
    /**
     * Función pura: mensaje JSON-RPC → respuesta JSON-RPC (objeto, arreglo para lotes, o null si es una notificación).
     * @param {unknown} mensaje
     * @param {{versionProtocolo?: string}} [ctx]
     */
    manejar: (mensaje, ctx) => manejarDetallado(mensaje, ctx).respuesta,
  };
}
