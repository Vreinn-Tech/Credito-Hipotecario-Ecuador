# Usarlo en Claude

Tres caminos para que Claude evalúe perfiles, simule cuotas y consulte los datos de crédito hipotecario de Ecuador. Elige según dónde uses Claude:

| Dónde | Camino | Qué obtienes |
| --- | --- | --- |
| Claude Code | [A. Plugin](#a-claude-code) (o solo el servidor MCP) | Herramientas MCP y skill |
| claude.ai, Claude Desktop y la app móvil | [B. Conector personalizado](#b-claudeai-y-claude-desktop-conector-remoto) y, opcional, la skill | Herramientas MCP y, si la subes, la skill |
| Claude Desktop, sin depender del servidor remoto | [C. Servidor local por stdio](#c-claude-desktop-con-servidor-local-stdio) | Herramientas MCP, con los datos de la copia local |

El servidor remoto es `https://creditohipotecarioecuador.com/mcp` (Streamable HTTP). Es de solo lectura y no pide cuenta ni clave. Las herramientas están descritas en [`mcp.md`](mcp.md).

La **skill** le indica a Claude cuándo usar cada herramienta, qué datos pedir (precio de la vivienda e ingreso como mínimo), cómo presentar el resultado y qué avisos incluir. Sin ella las herramientas funcionan igual; con ella las respuestas son más consistentes.

Los nombres de menú de esta página son los de la interfaz en inglés. Si usas Claude en español verás la traducción equivalente.

## A. Claude Code

### Instalar el plugin

El plugin incluye el servidor MCP remoto y la skill. Dentro de una sesión de Claude Code:

```text
/plugin marketplace add Vreinn-Tech/Credito-Hipotecario-Ecuador
/plugin install credito-hipotecario-ecuador@credito-hipotecario-ecuador
```

El segundo comando abre la ficha del plugin: revisa lo que instala y elige el alcance (para ti, para el repositorio o local). En Claude Code 2.1.275 o posterior, las dos líneas se reducen a una:

```text
/plugin install credito-hipotecario-ecuador --marketplace Vreinn-Tech/Credito-Hipotecario-Ecuador
```

Desde la terminal, sin abrir una sesión:

```bash
claude plugin marketplace add Vreinn-Tech/Credito-Hipotecario-Ecuador
claude plugin install credito-hipotecario-ecuador@credito-hipotecario-ecuador
```

Para comprobarlo, ejecuta `claude plugin list` en la terminal o `/mcp` dentro de una sesión: el servidor `credito-hipotecario-ecuador` debe aparecer conectado. Luego pregunta, por ejemplo:

> Gano 1.200 USD al mes, estoy afiliado al IESS con 48 aportaciones y quiero una casa de 70.000 USD. ¿A qué crédito califico?

Claude carga la skill por su cuenta cuando la pregunta trata de crédito de vivienda en Ecuador. También puedes invocarla con `/credito-hipotecario-ecuador:credito-hipotecario-ecuador`.

Para actualizar o quitar el plugin:

```bash
claude plugin update credito-hipotecario-ecuador@credito-hipotecario-ecuador
claude plugin uninstall credito-hipotecario-ecuador@credito-hipotecario-ecuador
claude plugin marketplace remove credito-hipotecario-ecuador
```

### Solo el servidor MCP

Si no quieres el plugin, añade únicamente el servidor:

```bash
claude mcp add --transport http credito-hipotecario-ecuador https://creditohipotecarioecuador.com/mcp
```

Por defecto queda disponible solo en el proyecto actual. Añade `--scope user` para tenerlo en todos tus proyectos, o `--scope project` para compartirlo con el equipo en el archivo `.mcp.json` del repositorio.

Para usar el servidor local en lugar del remoto:

```bash
claude mcp add credito-hipotecario-ecuador -- npx -y github:Vreinn-Tech/Credito-Hipotecario-Ecuador credito-hipotecario-ecuador-mcp
```

### Solo la skill

Copia la carpeta `plugins/credito-hipotecario-ecuador/skills/credito-hipotecario-ecuador/` a `~/.claude/skills/` (para ti) o a `.claude/skills/` (para un repositorio).

## B. claude.ai y Claude Desktop: conector remoto

Un conector personalizado se guarda en tu cuenta, así que sirve en la web, en la app de escritorio y en el móvil. Claude se conecta al servidor desde la nube de Anthropic, no desde tu equipo. En el plan gratuito solo se puede tener un conector personalizado.

1. Abre **Customize > Connectors**.
2. Pulsa **+ Add** y luego **Add custom connector**.
3. Escribe un nombre, por ejemplo `Crédito Hipotecario Ecuador`.
4. Pega la URL `https://creditohipotecarioecuador.com/mcp` y pulsa **Continue**.
5. En la autenticación elige **No sign in**: el servidor no pide cuenta.
6. Pulsa **Add**.

En los planes Team y Enterprise, un propietario añade primero el conector en **Organization settings > Connectors** (**Add**, **Custom**, **Web**). Después cada miembro lo busca en **Customize > Connectors** y pulsa **Connect**.

Para usarlo en una conversación, pulsa el botón **+** del cuadro de mensaje, entra en **Connectors** y activa el conector.

### Opcional: subir la skill

Requisito: tener activada la ejecución de código y creación de archivos en **Settings > Capabilities**. En Team y Enterprise la habilita un propietario junto con las skills.

1. Genera el ZIP (solo hace falta Node.js 18 o superior):

   ```bash
   git clone https://github.com/Vreinn-Tech/Credito-Hipotecario-Ecuador
   cd credito-hipotecario-ecuador
   node scripts/empaquetar-skill.mjs
   ```

   El archivo queda en `dist/credito-hipotecario-ecuador-skill.zip`. Contiene la carpeta `credito-hipotecario-ecuador/` con su `SKILL.md`, que es la estructura que exige claude.ai.
2. Abre **Customize > Skills**.
3. Pulsa **+**, luego **+ Create skill** y elige **Upload a skill**.
4. Sube el ZIP. La skill aparece en tu lista, donde puedes activarla o desactivarla.

### Alternativa: el plugin completo

En **Customize > Plugins** puedes añadir el plugin entero (skill y conector) en lugar de hacerlo por separado:

- **Add > Add marketplace** y escribe `Vreinn-Tech/Credito-Hipotecario-Ecuador`. El plugin aparece en la lista; ábrelo y pulsa **Add**.
- O bien **Add > Upload plugin** y sube `dist/credito-hipotecario-ecuador-plugin.zip`, que genera el mismo script.

Añadir el plugin no conecta el servidor: abre el plugin, entra en la pestaña **Connectors** y añade o conecta el conector desde ahí. Un plugin añadido así se guarda en tu cuenta y también llega a Claude Code como plugin sincronizado.

## C. Claude Desktop con servidor local (stdio)

El servidor se ejecuta en tu equipo y lee los datos incluidos en el paquete. Necesitas [Node.js](https://nodejs.org/) 18 o superior.

1. En Claude Desktop abre **Settings...** desde el menú de la aplicación (la barra de menús del sistema, no los ajustes de la ventana de chat).
2. Entra en la pestaña **Developer** y pulsa **Edit Config**. Se abre `claude_desktop_config.json`:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - Linux: `~/.config/Claude/claude_desktop_config.json`
3. Añade el servidor dentro de `mcpServers`. Si el archivo ya tiene otros servidores, consérvalos:

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

4. Guarda, cierra Claude Desktop por completo y vuelve a abrirlo.
5. En el cuadro de mensaje pulsa el botón **+**, entra en **Connectors** y luego en **Manage connectors**: `credito-hipotecario-ecuador` debe aparecer en la lista con sus herramientas.

`npx` necesita `git` para descargar el paquete desde GitHub. Si prefieres no depender de la red en cada arranque, clona el repositorio y apunta al archivo:

```json
{
  "mcpServers": {
    "credito-hipotecario-ecuador": {
      "command": "node",
      "args": ["/ruta/absoluta/a/credito-hipotecario-ecuador/bin/mcp.js"]
    }
  }
}
```

Si el servidor no aparece, revisa la sintaxis del JSON y los registros de Claude Desktop: `~/Library/Logs/Claude` en macOS, `%APPDATA%\Claude\logs` en Windows y `~/.config/Claude/logs` en Linux.

## Sin conexión al servidor

Si las herramientas no están disponibles, el mismo motor funciona desde la terminal:

```bash
npx -y github:Vreinn-Tech/Credito-Hipotecario-Ecuador evaluar --precio 70000 --ingreso 1200 --entrada 5000 --iess --aportaciones 48
```

## Aviso

Los resultados son referenciales y llevan la fecha del dato. No son una oferta de crédito ni asesoría financiera: verifica tasas, requisitos y condiciones con la entidad antes de decidir. La evaluación completa y gratuita está en <https://creditohipotecarioecuador.com/evaluacion/>.
