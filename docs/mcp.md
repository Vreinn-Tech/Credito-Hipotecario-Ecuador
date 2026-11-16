# Servidor MCP de crédito hipotecario Ecuador

Un servidor [MCP (Model Context Protocol)](https://modelcontextprotocol.io) para que Claude, ChatGPT y otros asistentes
**calculen con datos reales** en lugar de adivinar: evalúan a qué créditos de vivienda califica una persona en Ecuador,
simulan cuotas y consultan tasas, requisitos y entidades (BIESS, Miti-Miti VIS/VIP, bancos, cooperativas y mutualistas).

- **Servidor público:** `https://creditohipotecarioecuador.com/mcp` — Streamable HTTP, sin registro ni clave, solo lectura.
- **Local:** `npx -y github:Vreinn-Tech/Credito-Hipotecario-Ecuador credito-hipotecario-ecuador-mcp` (stdio).
- **Sin dependencias:** el protocolo está implementado a mano sobre el mismo evaluador y los mismos datos del paquete.
- **Metadatos para registros MCP:** [`server.json`](../server.json) describe el servidor remoto en el formato del [registro oficial de MCP](https://registry.modelcontextprotocol.io) (nombre `io.github.Vreinn-Tech/credito-hipotecario-ecuador`).
- **¿No programas?** Guía para el público, menú por menú: <https://creditohipotecarioecuador.com/asistentes-ia/>

> **Aviso.** Los datos son referenciales y cada uno lleva su fecha (`fechaDato`) y su fuente oficial (`fuenteUrl`). No es una
> oferta de crédito ni asesoría financiera: las tasas y requisitos cambian, y cada entidad hace su propio análisis. Verifica
> siempre con la entidad. Evaluación completa y gratuita: <https://creditohipotecarioecuador.com/evaluacion/>

## Qué puedes preguntar

Con el servidor conectado, escribe en tu asistente cosas como:

- «Gano 1.200 USD, soy afiliado con 48 aportaciones, ¿a qué crédito califico para una casa de 70.000?»
- «¿Cuánto pagaría al mes por 65.000 USD a 30 años con CrediCasa del BIESS? Muéstrame el resumen por año.»
- «Entre mi pareja y yo ganamos 2.400 USD y pagamos 300 de un auto. ¿Hasta cuánto nos prestan a 20 años al 9 %?»
- «Compara las tasas de los créditos hipotecarios de los bancos privados.»
- «¿Qué requisitos tiene Miti-Miti VIP y qué pasos sigo?»
- «¿Qué cooperativas dan crédito de vivienda en Loja?»
- «No estoy afiliado al IESS y soy independiente: ¿qué opciones tengo para un terreno de 30.000?»

## Herramientas

Todas son de solo lectura (`readOnlyHint: true`), devuelven texto legible y, además, `structuredContent` (JSON) con
`outputSchema`. Montos en USD, tasas en % nominal anual, plazos en años. Todas las respuestas terminan con el aviso legal y
la fuente. Los errores de validación llegan como resultado con `isError: true` y un mensaje que indica cómo corregir la llamada.

| Herramienta | Para qué sirve |
|---|---|
| `evaluar_perfil` | A qué créditos califica una persona: elegibilidad, puntaje, motivos, monto, cuota, plazo y entrada por producto. |
| `simular_cuota` | Cuota mensual, tasa efectiva, intereses y total pagado; resumen anual o tabla de amortización. |
| `capacidad_de_credito` | Cuota máxima y monto máximo que soportan unos ingresos. |
| `listar_programas` | Productos y programas con sus condiciones resumidas; filtros por categoría, entidad, destino y verificados. |
| `detalle_programa` | Ficha completa de un producto: requisitos, ventajas, desventajas, pasos, tramos, fuente y fecha. |
| `listar_entidades` | Entidades financieras: tipo, sitio, simulador oficial y cobertura; filtros por tipo y provincia. |
| `search` | Búsqueda por palabras clave en productos y entidades (forma que usa ChatGPT deep research). |
| `fetch` | Texto completo de un documento a partir del `id` que devuelve `search`. |

### `evaluar_perfil`

Obligatorios: `precioVivienda` e `ingresoMensual`. Opcionales (con su valor por defecto): `entradaDisponible` (0),
`deudasMensuales` (0), `afiliadoIess` (false), `aportaciones` (0), `edad` (35), `uso` (`vivienda_terminada`; también
`construccion`, `terreno`, `remodelacion`, `sustitucion`, `vis_vip`), `primeraVivienda` (true), `relacionLaboral`
(`dependiente`; también `independiente`, `jubilado`, `migrante`), `plazoDeseado` (20), `viviendaNueva` (sin valor),
`incluirNoAptos` (false) y `limite` (8).

Entrada:

```json
{ "precioVivienda": 70000, "ingresoMensual": 1200, "afiliadoIess": true, "aportaciones": 48, "limite": 1 }
```

Salida (`structuredContent`, abreviada: se omiten `perfil`, `aviso` y `fuente`):

```json
{
  "conteo": { "evaluados": 26, "aptos": 0, "condicionales": 18, "noAptos": 8, "devueltos": 1 },
  "resultados": [
    {
      "slug": "biess-credicasa",
      "nombre": "BIESS · CrediCasa 2,99 %",
      "entidad": "biess",
      "entidadNombre": "BIESS (Banco del IESS)",
      "categoria": "publico",
      "elegibilidad": "condicional",
      "score": 85,
      "razones": ["El monto máximo del producto es 65.000 USD; deberías cubrir la diferencia."],
      "montoFinanciable": 65000,
      "cuotaEstimada": 360.16,
      "plazo": 20,
      "entradaRequerida": 0,
      "capacidadMaxima": 86627.41,
      "tasaNominal": 2.99,
      "verificado": true,
      "fechaDato": "2026-04-01",
      "fuenteUrl": "https://www.biess.fin.ec/sala-de-prensa/noticias/noticia/archive/noticias/2026/04/01/-credicasa-facilita-el-sueno-de-tener-casa-propia-con-plazo-de-hasta-30-a-os",
      "url": "https://creditohipotecarioecuador.com/programas/biess-credicasa/"
    }
  ]
}
```

El texto que acompaña dice lo mismo en lenguaje natural:

```text
1. BIESS · CrediCasa 2,99 % — BIESS (Banco del IESS) [condicional, puntaje 85/100]
   Monto financiable: 65.000 USD · Cuota estimada: 360,16 USD/mes · Plazo: 20 años · Tasa nominal: 2,99 %
   Entrada requerida: 0 USD · Monto máximo según ingresos: 86.627 USD
   Observaciones: El monto máximo del producto es 65.000 USD; deberías cubrir la diferencia.
```

Los bonos y subsidios (categoría `subsidio`) no se evalúan: consúltalos con `listar_programas` y `detalle_programa`.
La cuota estimada incluye capital e interés, no seguros ni gastos legales.

### `simular_cuota`

`monto` y `plazoAnios` son obligatorios; la tasa se indica con `tasaNominalAnual` o con `programa` (slug) para usar la tasa
publicada del producto. `incluirTabla`: `ninguna` (por defecto), `anual` o `mensual`.

```json
{ "monto": 65000, "plazoAnios": 30, "programa": "biess-credicasa" }
```

```json
{
  "monto": 65000,
  "plazoAnios": 30,
  "numeroCuotas": 360,
  "tasaNominalAnual": 2.99,
  "tasaEfectivaAnual": 3.03,
  "cuotaMensual": 273.69,
  "totalIntereses": 33529.19,
  "totalPagado": 98529.19,
  "programa": { "slug": "biess-credicasa", "nombre": "BIESS · CrediCasa 2,99 %", "fechaDato": "2026-04-01", "verificado": true }
}
```

Con `"incluirTabla": "anual"` añade `resumenAnual` (`anio`, `cuotas`, `capitalPagado`, `interesPagado`, `saldoFinal`); con
`"mensual"`, `tabla` (`n`, `cuota`, `interes`, `capital`, `saldo`). Si el plazo o el monto se salen de los límites del
producto, lo indica en `advertencias`.

### `capacidad_de_credito`

Cuota máxima = `ratioCuotaIngreso` × (`ingresoMensual` − `deudasMensuales`), la misma fórmula del evaluador.
`ratioCuotaIngreso` vale 0.35 por defecto (el BIESS usa 0.40).

```json
{ "ingresoMensual": 1200, "deudasMensuales": 150, "tasaNominalAnual": 6.8, "plazoAnios": 25, "ratioCuotaIngreso": 0.4 }
```

```text
Con un ingreso de 1.200 USD/mes y deudas de 150 USD/mes (ingreso disponible: 1.050 USD), destinando el 40 % a la cuota:
- Cuota mensual máxima: 420,00 USD
- Monto máximo financiable a 25 años con tasa nominal de 6,80 %: 60.512 USD
```

### `listar_programas`

Filtros opcionales: `categoria` (`publico`, `preferencial`, `privado`, `subsidio`), `entidad` (slug), `uso` y `soloVerificados`.

```json
{ "categoria": "preferencial" }
```

```json
{
  "total": 2,
  "programas": [
    {
      "slug": "miti-miti-vip",
      "nombre": "Tu Casa Miti-Miti · VIP (Vivienda de Interés Público) al 4,99 %",
      "entidad": "mit",
      "entidadNombre": "MIT (Ministerio de Infraestructura y Tecnología, ex MIDUVI)",
      "categoria": "preferencial",
      "usos": ["vis_vip", "vivienda_terminada"],
      "tasaNominal": 4.88,
      "tasaEfectiva": 4.99,
      "plazoMinAnios": 20,
      "plazoMaxAnios": 30,
      "financiamientoMaxPct": 95,
      "entradaMinPct": 5,
      "montoMinUsd": null,
      "montoMaxUsd": 110378,
      "precioViviendaMinUsd": 85800.82,
      "precioViviendaMaxUsd": 110378,
      "ingresoMaxUsd": 3055.88,
      "requiereAfiliacionIess": false,
      "aportacionesMinimas": null,
      "soloPrimeraVivienda": true,
      "soloViviendaNueva": true,
      "fechaDato": "2026-03-23",
      "verificado": true,
      "url": "https://creditohipotecarioecuador.com/programas/miti-miti-vip/"
    }
  ]
}
```

(En la salida real `programas` trae los dos productos; aquí se muestra uno.)

### `detalle_programa`

```json
{ "slug": "miti-miti-vip" }
```

Devuelve `programa` (la ficha completa de `data/programas.json`: `resumen`, `descripcion`, `paraQuien`, `usos`, tasas,
plazos, montos, topes, `tramos`, `requisitos`, `ventajas`, `desventajas`, `pasos`, `fuenteUrl`, `fechaDato`, `verificado`),
`entidad` (nombre, tipo, sitio, simulador oficial, cobertura) y `url` de la ficha. El texto empieza así:

```text
Tu Casa Miti-Miti · VIP (Vivienda de Interés Público) al 4,99 % — MIT (Ministerio de Infraestructura y Tecnología, ex MIDUVI) (tasa preferencial VIS/VIP)
Crédito a tasa máxima del 4,99 % (4,87 % en Pichincha y Pacífico), 5 % de entrada y hasta 30 años, para la primera vivienda
nueva de entre 85.801 y 110.378 USD en proyectos calificados por el MIT. No exige afiliación al IESS.
```

### `listar_entidades`

Filtros opcionales: `tipo` (`publico`, `banco`, `cooperativa`, `mutualista`) y `provincia` (slug: `pichincha`, `guayas`,
`el-oro`…; incluye las de cobertura nacional).

```json
{ "tipo": "mutualista" }
```

```json
{
  "total": 4,
  "entidades": [
    {
      "slug": "mutualista-pichincha",
      "nombre": "Mutualista Pichincha",
      "tipo": "mutualista",
      "descripcion": "Mutualista de ahorro y crédito para la vivienda; entidad aliada del programa Tu Casa Miti-Miti (VIS/VIP).",
      "sitioUrl": "https://www.mutualistapichincha.com",
      "simuladorUrl": null,
      "cobertura": "nacional",
      "aliadaMitiMiti": true,
      "programas": []
    }
  ]
}
```

### `search` y `fetch`

Tienen la forma que OpenAI pide para deep research y «company knowledge» (ver [ChatGPT](#c-chatgpt)): `search` recibe
`query` y devuelve `{ "results": [{ "id", "title", "url" }] }`; `fetch` recibe `id` y devuelve
`{ "id", "title", "text", "url", "metadata" }`. El mismo JSON va también como texto en `content`.

```json
{ "query": "Miti-Miti VIP" }
```

```json
{
  "results": [
    { "id": "programa:miti-miti-vip", "title": "Tu Casa Miti-Miti · VIP (Vivienda de Interés Público) al 4,99 % — MIT (Ministerio de Infraestructura y Tecnología, ex MIDUVI)", "url": "https://creditohipotecarioecuador.com/programas/miti-miti-vip/" },
    { "id": "programa:miti-miti-vis", "title": "Tu Casa Miti-Miti · VIS (Vivienda de Interés Social) al 4,99 % — MIT (Ministerio de Infraestructura y Tecnología, ex MIDUVI)", "url": "https://creditohipotecarioecuador.com/programas/miti-miti-vis/" }
  ]
}
```

```json
{ "id": "entidad:jep" }
```

```json
{
  "id": "entidad:jep",
  "title": "Cooperativa JEP (entidad)",
  "text": "Cooperativa JEP (cooperativa)\nCooperativa de ahorro y crédito (SEPS, segmento 1).\nCobertura: azuay, canar, guayas, el-oro, loja, morona-santiago, pichincha.\nSitio oficial: https://www.jep.coop\n…",
  "url": "https://www.jep.coop",
  "metadata": { "tipo": "entidad", "tipoEntidad": "cooperativa", "fechaDato": "2026-09-01", "fuenteUrl": "https://www.jep.coop/documents/20182/0/CostosFinancierosSeptiembre2026.pdf" }
}
```

## Cómo conectarlo

Los pasos de interfaz se verificaron en la documentación oficial el **15 de noviembre de 2026**; los nombres de los menús
cambian con frecuencia, así que si no coinciden busca la opción equivalente («conectores», «servidor MCP personalizado»).
En todos los casos: URL `https://creditohipotecarioecuador.com/mcp`, **sin autenticación**.

### a) Claude (claude.ai y Claude Desktop)

1. Abre **Customize → Connectors**.
2. Pulsa **+ Add** y luego **Add custom connector**.
3. Ponle un nombre (p. ej. «Crédito Hipotecario Ecuador») y pega la URL `https://creditohipotecarioecuador.com/mcp`.
4. Continúa; en autenticación elige la opción sin inicio de sesión (**No sign in**) y confirma con **Add**.
5. En un chat, pulsa **+** → **Connectors** y activa el conector.

En planes Team y Enterprise lo añade un propietario desde **Organization settings → Connectors → Add → Custom → Web** y
después cada miembro lo conecta. Los conectores remotos se configuran en tu cuenta de Claude y sirven también en Claude
Desktop; las conexiones salen de la infraestructura de Anthropic, no de tu equipo.
Fuente: [Get started with custom connectors using remote MCP](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).

### b) Claude Code

```bash
claude mcp add --transport http credito-hipotecario-ecuador https://creditohipotecarioecuador.com/mcp
```

Comprueba con `claude mcp list` o con `/mcp` dentro de una sesión. Añade `--scope project` para compartirlo con el equipo
en el `.mcp.json` del repositorio.

### c) ChatGPT

1. Entra en **ChatGPT Plugins** (`chatgpt.com/plugins`), pulsa el botón **+** y elige **Add custom MCP server**.
2. Escribe un nombre y, en **Connection**, la **Server URL** `https://creditohipotecarioecuador.com/mcp`.
3. En autenticación elige **sin autenticación** (*No authentication*).
4. Lee el aviso de riesgo, marca **I understand and want to continue** y pulsa **Create as a plugin**.
5. Instala el plugin (aparece entre tus plugins personales o los del espacio de trabajo) y úsalo en un chat o en deep research.

Lo que exige ChatGPT, según la documentación de OpenAI consultada el 15 de noviembre de 2026:

- Acepta servidores remotos por **SSE o Streamable HTTP** (este servidor usa Streamable HTTP), con OAuth o sin autenticación.
  La documentación solo contempla servidores remotos (no locales por stdio).
- **`search` y `fetch` ya no son obligatorias** para conectar un servidor: ChatGPT expone todas las herramientas. Siguen
  siendo las que usan **deep research** y **company knowledge**, con una forma concreta de entrada y salida; por eso este
  servidor las incluye.
- Respeta la anotación `readOnlyHint`: las herramientas sin ella se tratan como acciones de escritura y piden confirmación.
  Todas las de este servidor son de solo lectura.
- La disponibilidad depende del plan y de los permisos del espacio de trabajo; la documentación no detalla planes.

Fuentes: [Building MCP servers for ChatGPT and API integrations](https://developers.openai.com/api/docs/mcp) y
[Developer mode / custom MCP servers](https://developers.openai.com/api/docs/guides/developer-mode).

### d) Local por stdio (Claude Desktop, Cursor, VS Code, etc.)

Necesitas Node.js 18 o superior. El servidor corre en tu máquina, sin red, con los datos del paquete:

```bash
npx -y github:Vreinn-Tech/Credito-Hipotecario-Ecuador credito-hipotecario-ecuador-mcp
```

Forma equivalente, que elige el ejecutable con la opción estándar `-p` de npx:

```bash
npx -y -p github:Vreinn-Tech/Credito-Hipotecario-Ecuador credito-hipotecario-ecuador-mcp
```

Bloque para clientes que usan `mcpServers` (por ejemplo `claude_desktop_config.json` en Claude Desktop o `.mcp.json`):

```json
{
  "mcpServers": {
    "credito-hipotecario-ecuador": {
      "command": "npx",
      "args": ["-y", "github:Vreinn-Tech/Credito-Hipotecario-Ecuador", "credito-hipotecario-ecuador-mcp"]
    }
  }
}
```

En Claude Code: `claude mcp add credito-hipotecario-ecuador -- npx -y github:Vreinn-Tech/Credito-Hipotecario-Ecuador credito-hipotecario-ecuador-mcp`.

Por stdout solo salen mensajes MCP (un JSON por línea); los registros van a stderr. Para fijar una versión, añade una
etiqueta o un commit: `github:Vreinn-Tech/Credito-Hipotecario-Ecuador#v0.1.0`.

### e) Autoalojarlo

El manejador HTTP usa solo APIs web estándar (`Request` → `Response`), así que corre igual en Cloudflare Workers, Pages
Functions, Deno, Bun o Node.

**Cloudflare Workers**

```js
// src/worker.js
import { crearManejadorHttp } from 'credito-hipotecario-ecuador/mcp';
import programas from 'credito-hipotecario-ecuador/data/programas.json';
import entidades from 'credito-hipotecario-ecuador/data/entidades.json';

const manejar = crearManejadorHttp({ programas, entidades });

export default {
  fetch(request) {
    const { pathname } = new URL(request.url);
    if (pathname === '/mcp' || pathname === '/mcp/') return manejar(request);
    return new Response('No encontrado', { status: 404 });
  },
};
```

**Cloudflare Pages Functions** (así está publicado en creditohipotecarioecuador.com): un archivo `functions/mcp.js`.

```js
import { crearManejadorHttp } from 'credito-hipotecario-ecuador/mcp';
import programas from 'credito-hipotecario-ecuador/data/programas.json';
import entidades from 'credito-hipotecario-ecuador/data/entidades.json';

const manejar = crearManejadorHttp({ programas, entidades });
export const onRequest = ({ request }) => manejar(request);
```

**Node** (servidor local en `http://127.0.0.1:3333/mcp`):

```bash
npx -y github:Vreinn-Tech/Credito-Hipotecario-Ecuador credito-hipotecario-ecuador-mcp --http 3333
```

Escucha solo en `127.0.0.1`; para otro host usa la variable `HOST` y, en ese caso, pon el servidor detrás de HTTPS.

Opciones de `crearManejadorHttp({ programas, entidades, … })`:

| Opción | Por defecto | Qué hace |
|---|---|---|
| `maxBytes` | `262144` | Tamaño máximo del cuerpo; por encima responde 413. |
| `origenesPermitidos` | (cualquiera) | Lista de valores `Origin` aceptados; el resto recibe 403. Úsala al exponer el servidor en tu propia máquina o red, contra ataques de DNS rebinding. |
| `version` | la del paquete | Versión que anuncia el servidor. |

Puedes pasar tus propios datos (por ejemplo, una copia actualizada de los JSON) siempre que respeten la forma de
`data/programas.json` y `data/entidades.json`.

## Para integradores

### Usar el núcleo sin transporte

```js
import { crearServidorMcp } from 'credito-hipotecario-ecuador/mcp';

const servidor = crearServidorMcp({ programas, entidades });
const respuesta = servidor.manejar({
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: { name: 'simular_cuota', arguments: { monto: 65000, plazoAnios: 30, programa: 'biess-credicasa' } },
});
```

`manejar(mensaje, { versionProtocolo })` es una función pura: recibe un mensaje JSON-RPC ya parseado y devuelve la
respuesta, o `null` si era una notificación. No guarda estado entre llamadas.

### Protocolo

- **Versiones admitidas:** `2026-07-28` (sin handshake: versión y capacidades del cliente en `params._meta` de cada
  petición, `server/discover`, `resultType` en los resultados) y las versiones con `initialize`: `2025-11-25`,
  `2025-06-18`, `2025-03-26` y `2024-11-05`. En `initialize` se responde la versión del cliente si está en la lista y, si
  no, `2025-11-25`. Una versión desconocida en `_meta` o en la cabecera `MCP-Protocol-Version` recibe el error `-32022`
  con la lista de versiones admitidas.
- **Capacidades:** solo `tools`. No hay recursos, prompts, sesiones, suscripciones ni peticiones del servidor al cliente.
- **Según la versión:** `structuredContent`, `outputSchema` y `title` se envían desde `2025-06-18` (en versiones
  anteriores el JSON va como segundo bloque de texto); las anotaciones, desde `2025-03-26`; los lotes JSON-RPC solo se
  aceptan en `2025-03-26` y `2024-11-05`.
- **Errores:** `-32700` (JSON no válido), `-32600` (mensaje no válido), `-32601` (método desconocido), `-32602`
  (parámetros no válidos o herramienta inexistente), `-32020` (las cabeceras HTTP no coinciden con el cuerpo), `-32022`
  (versión no admitida). Los errores de validación de una herramienta no son errores de protocolo: llegan como resultado
  con `isError: true`.

### HTTP

| Petición | Respuesta |
|---|---|
| `POST` con una petición JSON-RPC | `200` y `application/json` (nunca SSE) |
| `POST` con una notificación | `202` sin cuerpo |
| `POST` con JSON roto / mensaje no válido | `400` con `-32700` / `-32600` |
| `POST` sin `Content-Type: application/json` | `415` |
| `POST` con cuerpo mayor que `maxBytes` | `413` |
| `GET` con `Accept: text/event-stream` | `405` (no hay stream del servidor al cliente) |
| `GET` desde un navegador (`Accept: text/html`) | `200` con una página que explica qué es y enlaza la documentación |
| `OPTIONS` | `204` con CORS abierto (`Access-Control-Allow-Origin: *`) |
| `DELETE` y el resto | `405` |

Todas las respuestas llevan `Cache-Control: no-store`. `Mcp-Session-Id` y `Last-Event-ID` se ignoran: no hay sesiones.
Con `2026-07-28` se validan las cabeceras `MCP-Protocol-Version`, `Mcp-Method` y `Mcp-Name` contra el cuerpo, y los
errores de protocolo usan los códigos HTTP que pide la especificación (`400`, o `404` para un método desconocido); con las
versiones anteriores los errores JSON-RPC viajan con `200`.

Prueba rápida con `curl`:

```bash
curl -s https://creditohipotecarioecuador.com/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"evaluar_perfil","arguments":{"precioVivienda":70000,"ingresoMensual":1200,"afiliadoIess":true,"aportaciones":48}}}'
```

### Pruebas

```bash
node --test test/mcp*.test.js
```

Cubren el protocolo en sus dos generaciones, cada herramienta, el manejador HTTP con objetos `Request` reales y el
transporte stdio lanzando `bin/mcp.js` como proceso hijo. La interoperabilidad se comprobó además con los clientes
oficiales `@modelcontextprotocol/sdk` 1.32.2 y `@modelcontextprotocol/client` 2.4.0, por stdio y por Streamable HTTP.

## Aviso legal

La información que entrega este servidor es referencial y educativa. Cada dato indica su fecha (`fechaDato`), su fuente
oficial (`fuenteUrl`) y si está verificado (`verificado: false` = dato preliminar). No constituye una oferta ni una
aprobación de crédito, ni asesoría financiera, legal o tributaria. Las cuotas son estimaciones de capital e interés, sin
seguros ni gastos. Las tasas, montos y requisitos cambian: confírmalos con la entidad financiera antes de tomar una
decisión. Fuente: [creditohipotecarioecuador.com](https://creditohipotecarioecuador.com) ·
[evaluación completa](https://creditohipotecarioecuador.com/evaluacion/).
