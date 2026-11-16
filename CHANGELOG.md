# Registro de cambios

Los cambios relevantes de este proyecto se anotan aquí. El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y las versiones, [SemVer](https://semver.org/lang/es/).

Las correcciones de datos (una tasa, un plazo, un requisito) suben la versión de parche e indican la fecha del dato.

## [0.1.2] - 2026-11-16

Prepara la publicación en los directorios de Claude y ChatGPT. El motor, los datos y los nombres de las herramientas no cambian.

### Añadido

- Icono (`assets/icono.svg`, `assets/icono-512.png`, `assets/icono-1024.png`) y `plugins/credito-hipotecario-ecuador/.claude-plugin/icon.png` (512×512): resuelve el aviso `ICON_MISSING` de `claude plugin validate --strict`.
- Paquete para el directorio de ChatGPT: manifiesto Agent Plugins en `openai/plugin.json` y `openai/mcp.json`, y `npm run openai` (`scripts/empaquetar-openai.mjs`), que valida los límites de OpenAI y genera `dist/credito-hipotecario-ecuador-openai.zip`.
- `USO_ORIENTATIVO` exportado desde `credito-hipotecario-ecuador/mcp`.

### Cambiado

- `evaluar_perfil` empieza con «Estima a qué créditos… podría calificar» (antes «Evalúa… califica»). Las descripciones de `evaluar_perfil` y `capacidad_de_credito` terminan con: «Es una estimación orientativa con las reglas públicas de cada producto: no consulta buró de crédito ni datos personales, no es una evaluación de solvencia ni una decisión, oferta o aprobación de crédito, y no debe usarse para decidir sobre el crédito de una persona.»; la de `simular_cuota` aclara que es un cálculo orientativo. Las `instructions` de `initialize` dicen lo mismo en una línea.
- El aviso de cada respuesta (`AVISO`/`NOTA`) dice «Resultado orientativo… no es una oferta ni una aprobación de crédito, ni asesoría financiera».
- La skill añade la sección «Uso orientativo, nunca para decidir un crédito»: el resultado se presenta como orientativo y, si un prestamista o un tercero pide decidir sobre el crédito de una persona, el asistente no usa las herramientas con ese fin y explica por qué.
- `plugin.json`, `marketplace.json`, `server.json` y el README del plugin hablan de estimación orientativa; el README del plugin añade la línea de instalación desde el marketplace.
- Los ZIP de `scripts/empaquetar-skill.mjs` y `scripts/empaquetar-openai.mjs` comparten `scripts/zip.mjs`.
- `files` del paquete npm incluye `assets`, `.claude-plugin` y `plugins` (con el icono).

## [0.1.1] - 2026-11-16

Corrige tres fallos del motor de elegibilidad encontrados en una revisión externa. Los datos no cambian.

### Corregido

- **La entrada requerida no tenía en cuenta el monto máximo del producto.** Ahora `entradaRequerida = max(0, precio − min(precio × % financiable, montoMaxUsd))` y `montoFinanciable = min(lo que necesitas, ese tope)`. Si tu entrada no alcanza y el límite lo fija `montoMaxUsd`, la observación es «El monto máximo del producto es X USD: necesitas una entrada de al menos Y USD.»; si lo fija el porcentaje, se mantiene la del porcentaje. Desaparece la observación «…deberías cubrir la diferencia», que contradecía `entradaRequerida: 0`. Ejemplo: vivienda de 70.000 USD en CrediCasa (financia el 100 % hasta 65.000 USD) pasa de `entradaRequerida: 0` a `5000`; con 5.000 USD de entrada sigue siendo «apto».
- **Un plazo deseado menor que el mínimo del producto se usaba tal cual.** Ahora el plazo sube a `plazoMinAnios` y el resultado queda «condicional» con «El plazo mínimo del producto es de N años; la cuota se calcula a N años.». Orden: primero el plazo máximo, luego el mínimo y después la edad (que sigue bloqueando si no permite ni el mínimo).
- **Un requisito desconocido contaba como cumplido.** En los productos solo para vivienda nueva (`soloViviendaNueva`: CrediCasa y Tu Casa Miti-Miti), si no se indica `viviendaNueva`, el resultado es «condicional» con «Solo financia vivienda nueva de primer uso: confirma que la vivienda lo es.» en lugar de «apto». Con `viviendaNueva: false` sigue bloqueando.

### Cambiado

- La demo de GitHub Pages tiene la casilla «Vivienda nueva (primer uso)», marcada por defecto.
- El README, `docs/mcp.md`, `docs/claude.md`, la skill y la ayuda del CLI usan `--nueva` / `viviendaNueva` en los ejemplos y explican las nuevas reglas. La skill pide confirmar si la vivienda es nueva o usada cuando importa.

## [0.1.0] - 2026-11-15

Primera versión pública, extraída del sitio [creditohipotecarioecuador.com](https://creditohipotecarioecuador.com).

### Añadido

- Motor de elegibilidad (`evaluarPrograma`, `evaluarTodos`, `evaluarPerfil`, `normalizarPerfil`): clasifica cada producto como apto, condicional o no apto, explica por qué y estima monto, cuota y entrada.
- Utilidades financieras (`cuotaMensual`, `tablaAmortizacion`, `tasaEfectiva`, `capacidadDeCredito`, `fmtUSD`, `fmtPct`): sistema francés con capitalización mensual.
- Datos abiertos: 28 productos (`data/programas.json`) y 39 entidades (`data/entidades.json`), con fuente y fecha por registro, esquemas JSON Schema y diccionario de datos.
- CLI `credito-hipotecario-ecuador` con los comandos `evaluar`, `cuota`, `programas`, `programa` y `entidades`.
- Servidor MCP (`credito-hipotecario-ecuador-mcp`) para asistentes de IA.
- Tipos de TypeScript.
