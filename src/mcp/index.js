/**
 * Servidor MCP de crédito hipotecario Ecuador. Sin dependencias y sin node:* (apto para Workers, Deno, Bun y Node):
 *  - crearServidorMcp({ programas, entidades })  → { manejar(mensajeJsonRpc) } puro.
 *  - crearManejadorHttp({ programas, entidades }) → (Request) => Promise<Response> (Streamable HTTP sin estado).
 *  - iniciarStdio({ programas, entidades })       → transporte stdio (lo usa bin/mcp.js).
 * Para un servidor node:http listo para usar, importa "./nodo.js" (solo Node) o ejecuta `credito-hipotecario-ecuador-mcp --http`.
 * Documentación: docs/mcp.md
 */
export {
  crearServidorMcp,
  errorJsonRpc,
  NOMBRE_SERVIDOR,
  VERSION_SERVIDOR,
  VERSION_MODERNA,
  VERSIONES_CLASICAS,
  VERSIONES_SOPORTADAS,
  INSTRUCCIONES,
  CODIGOS,
} from './servidor.js';
export { crearManejadorHttp, URL_DOCUMENTACION, URL_MCP_PUBLICA } from './http.js';
export { iniciarStdio } from './stdio.js';
export { crearHerramientas, ErrorDeHerramienta, AVISO, NOTA } from './herramientas.js';
