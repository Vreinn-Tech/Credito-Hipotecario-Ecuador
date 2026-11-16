# Registro de cambios

Los cambios relevantes de este proyecto se anotan aquí. El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y las versiones, [SemVer](https://semver.org/lang/es/).

Las correcciones de datos (una tasa, un plazo, un requisito) suben la versión de parche e indican la fecha del dato.

## [0.1.0] - 2026-11-15

Primera versión pública, extraída del sitio [creditohipotecarioecuador.com](https://creditohipotecarioecuador.com).

### Añadido

- Motor de elegibilidad (`evaluarPrograma`, `evaluarTodos`, `evaluarPerfil`, `normalizarPerfil`): clasifica cada producto como apto, condicional o no apto, explica por qué y estima monto, cuota y entrada.
- Utilidades financieras (`cuotaMensual`, `tablaAmortizacion`, `tasaEfectiva`, `capacidadDeCredito`, `fmtUSD`, `fmtPct`): sistema francés con capitalización mensual.
- Datos abiertos: 28 productos (`data/programas.json`) y 39 entidades (`data/entidades.json`), con fuente y fecha por registro, esquemas JSON Schema y diccionario de datos.
- CLI `credito-hipotecario-ecuador` con los comandos `evaluar`, `cuota`, `programas`, `programa` y `entidades`.
- Servidor MCP (`credito-hipotecario-ecuador-mcp`) para asistentes de IA.
- Tipos de TypeScript.
