# Cómo contribuir

Gracias por ayudar a mantener estos datos al día. Las tasas y condiciones de los créditos cambian a menudo, así que la contribución más valiosa es **avisar cuando un dato quedó desactualizado**.

## Corregir una tasa o una condición

Toda corrección necesita dos cosas:

1. **Fuente oficial**: el enlace a la página de la entidad (o del BIESS, el MIT, la Junta de Política y Regulación Financiera, el Banco Central o la Superintendencia) donde se lee el dato. Un tarifario en PDF publicado por la entidad sirve. No sirven notas de prensa de terceros, redes sociales de asesores, capturas de WhatsApp ni «me lo dijeron en la agencia».
2. **Fecha del dato**: el día en que la fuente lo publicó o, si no lo indica, el día en que lo consultaste.

### Opción A: abrir un issue (no hace falta saber programar)

Abre un issue en <https://github.com/Vreinn-Tech/Credito-Hipotecario-Ecuador/issues> con:

- el producto (por ejemplo `produbanco-hipotecario`) y el campo (por ejemplo «tasa nominal»);
- el valor que aparece ahora y el valor correcto;
- el enlace a la fuente oficial;
- la fecha del dato.

### Opción B: enviar un pull request

1. Edita el registro en `data/programas.json` (o `data/entidades.json`).
2. Actualiza en ese mismo registro:
   - `fuenteUrl`: el enlace oficial, con `https://`;
   - `fechaDato`: la fecha en formato `AAAA-MM-DD`;
   - `verificado`: `true` solo si el valor se lee tal cual en la fuente oficial; si lo dedujiste o viene de una fuente secundaria, déjalo en `false`.
3. Si cambias `tasaNominal`, revisa `tasaEfectiva` (y al revés). Con capitalización mensual, `efectiva = ((1 + nominal / 1200)^12 − 1) × 100`. Si la entidad publica una efectiva distinta, respeta la que publica.
4. Regenera las tablas de la documentación y ejecuta las pruebas:

   ```bash
   npm run tablas
   npm test
   ```

5. En la descripción del pull request indica qué cambió, la fuente y la fecha. Añade una línea a `CHANGELOG.md`.

El significado de cada campo, con sus unidades, está en [`data/README.md`](data/README.md).

### Reglas de los datos

- Montos en dólares (USD), sin separador de miles. Tasas en porcentaje anual (`8.5` es 8,5 %). Plazos en años. `ratioCuotaIngreso` es una fracción (`0.35` es 35 %).
- Si un dato no está publicado, usa `null` (en los campos que lo admiten) y explícalo en `tasaNota` o en `descripcion`. No inventes valores ni los copies de otra entidad.
- Los `slug` no se cambian: otros proyectos enlazan con ellos.
- Un cambio por pull request: es más fácil de revisar y de revertir.

## Añadir un producto o una entidad

Los mismos requisitos: fuente oficial y fecha. La entidad debe estar supervisada por la Superintendencia de Bancos o por la Superintendencia de Economía Popular y Solidaria. Copia un registro parecido, completa todos los campos obligatorios (los valida `npm test` contra los esquemas de `data/`) y, si el producto es de una entidad nueva, añádela primero a `data/entidades.json`.

## Cambios en el código

- Node 18 o superior. Sin dependencias de runtime: el paquete debe seguir instalándose sin descargar nada más.
- `src/finanzas.js` y `src/evaluacion.js` son código puro: no deben importar módulos de Node, para que funcionen en navegadores y Workers.
- Todo texto para personas va en español.
- Añade o ajusta pruebas en `test/` (se ejecutan con `node --test`).
- El motor de elegibilidad es el mismo que usa el sitio creditohipotecarioecuador.com. Un cambio en las reglas o en la fórmula del puntaje se discute antes en un issue, porque debe aplicarse en ambos lados a la vez.

## Qué no publicar

No incluyas datos personales (ni tuyos ni de clientes), credenciales, ni documentos internos de una entidad que no sean públicos.

## Licencia de las contribuciones

Al contribuir aceptas que tu aporte se publique con las licencias del proyecto: MIT para el código y CC BY 4.0 para los datos.
