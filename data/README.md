# Datos abiertos de crédito de vivienda en Ecuador

Esta carpeta contiene los datos que usa el evaluador de [creditohipotecarioecuador.com](https://creditohipotecarioecuador.com):

| Archivo | Contenido |
| --- | --- |
| [`programas.json`](programas.json) | 28 productos: créditos del BIESS, programas de tasa preferencial VIS/VIP, hipotecarios de bancos, cooperativas y mutualistas, y subsidios del Estado. |
| [`entidades.json`](entidades.json) | 39 instituciones: el BIESS, el MIT, bancos, cooperativas y mutualistas. |
| [`programas.schema.json`](programas.schema.json) | Esquema (JSON Schema 2020-12) de `programas.json`. |
| [`entidades.schema.json`](entidades.schema.json) | Esquema (JSON Schema 2020-12) de `entidades.json`. |

Licencia: [CC BY 4.0](../LICENSE-DATA.md). Si los usas, atribuye así: «Fuente: [creditohipotecarioecuador.com](https://creditohipotecarioecuador.com)».

> **Información referencial.** No es una oferta de crédito ni asesoría financiera. Las tasas y condiciones cambian: cada registro indica de cuándo es el dato (`fechaDato`) y de dónde salió (`fuenteUrl`). Verifica siempre con la entidad antes de decidir.

## Cómo leer la calidad de un dato

Tres campos acompañan a cada registro y dicen cuánto puedes fiarte de él:

- **`fuenteUrl`**: la página oficial de la que salió el dato (la entidad, el BIESS, el MIT o un regulador). Siempre empieza por `https://`.
- **`fechaDato`**: la fecha del dato en formato `AAAA-MM-DD`: el día en que la fuente lo publicó o, si no lo indica, el día en que se consultó. No es la fecha en que se editó el archivo. En las entidades el campo es opcional: si falta, no se pudo confirmar la fecha y conviene tratar ese registro como de antigüedad desconocida.
- **`verificado`** (solo productos): `true` cuando las cifras principales se confirmaron en la fuente oficial. **`verificado: false` significa dato preliminar**: procede de una fuente secundaria, de un tarifario antiguo o de una estimación, y todavía no se confirmó con la entidad. Sirve para orientarse, no para citarlo como la tasa vigente. El evaluador resta 2 puntos a esos productos y la CLI los marca con un asterisco.

## Unidades y convenciones

- Montos, precios e ingresos: **dólares de los Estados Unidos (USD)**; el ingreso es mensual.
- Tasas: **porcentaje anual** (`8.5` es 8,5 %).
- Plazos: **años**. Edades: años cumplidos. Aportaciones al IESS: **meses**.
- Porcentajes de financiamiento y de entrada: de 0 a 100, sobre el avalúo o el precio de la vivienda.
- `ratioCuotaIngreso`: **fracción** de 0 a 1 (`0.35` es 35 %).
- `null` significa «no publicado» o «no aplica». Un campo opcional ausente significa «sin esa restricción».
- Los `slug` son identificadores estables en minúsculas y con guiones.

## Diccionario de `programas.json`

Cada elemento de la lista es un producto. «Oblig.» indica si el campo está siempre presente.

### Identificación y textos

| Campo | Tipo | Oblig. | Significado |
| --- | --- | :---: | --- |
| `slug` | texto | sí | Identificador único, p. ej. `biess-credicasa`. La ficha en línea está en `https://creditohipotecarioecuador.com/programas/<slug>/`. |
| `nombre` | texto | sí | Nombre comercial del producto. |
| `entidad` | texto | sí | `slug` de la institución en `entidades.json`. |
| `categoria` | texto | sí | `publico` (créditos del BIESS), `preferencial` (tasa subsidiada VIS/VIP), `privado` (bancos, cooperativas y mutualistas) o `subsidio` (bonos del Estado; no son créditos y el evaluador no los puntúa). |
| `resumen` | texto | sí | Una o dos frases con lo esencial. |
| `descripcion` | texto | sí | Explicación completa del producto. |
| `paraQuien` | texto | sí | A quién va dirigido. |
| `usos` | lista de textos | sí | Destinos que financia: `vivienda_terminada` (compra de vivienda terminada), `construccion` (en terreno propio), `terreno` (compra de terreno), `remodelacion` (ampliación o remodelación), `sustitucion` (traslado de una hipoteca) y `vis_vip` (vivienda de interés social o público). |
| `requisitos` | lista de textos | sí | Requisitos principales. |
| `ventajas` | lista de textos | sí | Puntos a favor. |
| `desventajas` | lista de textos | sí | Puntos en contra. |
| `pasos` | lista de textos | no | Pasos del trámite, en orden. |

### Tasa, plazo y montos

| Campo | Tipo | Unidad | Oblig. | Significado |
| --- | --- | --- | :---: | --- |
| `tasaNominal` | número o `null` | % anual | sí | Tasa nominal anual de referencia. Es la que usa el evaluador para estimar la cuota. `null` en subsidios. |
| `tasaEfectiva` | número o `null` | % anual | sí | Tasa efectiva anual publicada o equivalente a la nominal con capitalización mensual. |
| `tasaNota` | texto | — | no | Matices de la tasa: si es fija o reajustable, rangos por monto o plazo, de dónde sale el valor de referencia. |
| `plazoMinAnios` | número o `null` | años | sí | Plazo mínimo. |
| `plazoMaxAnios` | número o `null` | años | sí | Plazo máximo. |
| `financiamientoMaxPct` | número o `null` | % | sí | Porcentaje máximo del avalúo o precio que se financia. Si hay `tramos`, es el del primer tramo. |
| `entradaMinPct` | número o `null` | % | sí | Entrada mínima; normalmente `100 − financiamientoMaxPct`. |
| `tramos` | lista de `{ hastaUsd, pct }` | USD, % | no | Financiamiento según el valor de la vivienda, de menor a mayor: se aplica el primer tramo cuyo `hastaUsd` sea igual o mayor que el precio. Tiene prioridad sobre `financiamientoMaxPct`. |
| `montoMinUsd` | número o `null` | USD | sí | Monto mínimo del crédito. |
| `montoMaxUsd` | número o `null` | USD | sí | Monto máximo del crédito (en subsidios, el valor máximo del bono). |

### Restricciones de elegibilidad

| Campo | Tipo | Unidad | Oblig. | Significado |
| --- | --- | --- | :---: | --- |
| `precioViviendaMaxUsd` | número o `null` | USD | sí | Precio o avalúo máximo de la vivienda. `null` = sin tope. |
| `precioViviendaMinUsd` | número | USD | no | Precio mínimo del segmento (VIP). |
| `ingresoMaxUsd` | número | USD/mes | no | Tope de ingresos familiares mensuales. |
| `requiereAfiliacionIess` | booleano | — | sí | `true` si solo es para afiliados o jubilados del IESS. |
| `aportacionesMinimas` | entero | meses | no | Aportaciones mínimas al IESS. |
| `edadMin` | entero o `null` | años | sí | Edad mínima del solicitante. |
| `edadMax` | entero o `null` | años | sí | Edad máxima **al terminar de pagar** el crédito. |
| `ratioCuotaIngreso` | número | fracción | sí | Parte máxima del ingreso disponible que puede ir a la cuota. |
| `soloPrimeraVivienda` | booleano | — | sí | `true` si exige no tener otra vivienda. |
| `soloViviendaNueva` | booleano | — | no | `true` si solo financia vivienda nueva de primer uso. |

### Procedencia

| Campo | Tipo | Oblig. | Significado |
| --- | --- | :---: | --- |
| `fuenteUrl` | texto (URL `https://`) | sí | Fuente oficial del dato. |
| `fechaDato` | texto | sí | `AAAA-MM-DD`. Ver [Cómo leer la calidad de un dato](#cómo-leer-la-calidad-de-un-dato). |
| `verificado` | booleano | sí | `false` = dato preliminar. |

## Diccionario de `entidades.json`

| Campo | Tipo | Oblig. | Significado |
| --- | --- | :---: | --- |
| `slug` | texto | sí | Identificador único, p. ej. `biess`. Es el valor de `entidad` en los productos. |
| `nombre` | texto | sí | Nombre de la institución. |
| `tipo` | texto | sí | `publico`, `banco`, `cooperativa` o `mutualista`. |
| `descripcion` | texto | sí | Qué es y a quién atiende. |
| `sitioUrl` | texto (URL `https://`) | no | Sitio oficial. |
| `simuladorUrl` | texto (URL `https://`) | no | Simulador o página de crédito de vivienda de la entidad. |
| `coberturaProvincias` | `"nacional"` o lista de textos | sí | Provincias con agencias, como slugs (`azuay`, `el-oro`, `pichincha`…). Una lista vacía significa cobertura no confirmada. |
| `fuenteUrl` | texto (URL `https://`) | no | Fuente de los datos de la entidad. |
| `fechaDato` | texto | no | `AAAA-MM-DD`; se omite cuando no se pudo confirmar. |
| `miti` | booleano | no | `true` si la entidad es aliada del programa Tu Casa Miti-Miti. |

No todas las entidades tienen productos con ficha en `programas.json`: algunas figuran solo como directorio.

## Resumen de los 28 productos

Tabla generada a partir de `programas.json` con `npm run tablas`. La tasa es la nominal de referencia; cuando el financiamiento depende del valor de la vivienda se muestra el rango. El asterisco (\*) marca los datos preliminares (`verificado: false`).

<!-- tabla:programas:inicio -->
| Producto | Entidad | Tasa nominal | Plazo máx. | Financiamiento máx. | Fecha del dato |
| --- | --- | ---: | ---: | ---: | --- |
| BIESS · CrediCasa 2,99 % | BIESS (Banco del IESS) | 2,99 % | 30 años | 100 % | 2026-04-01 |
| BIESS · Vivienda terminada (nueva o usada) | BIESS (Banco del IESS) | 6,80 % | 25 años | 80–95 % | 2026-06-27 |
| BIESS · Construcción de vivienda | BIESS (Banco del IESS) | 6,80 % | 25 años | 80–100 % | 2026-01-15 |
| BIESS · Compra de terreno | BIESS (Banco del IESS) | 6,80 % | 10 años | 90 % | 2026-01-15 |
| BIESS · Ampliación y remodelación \* | BIESS (Banco del IESS) | 6,80 % | 15 años | 50 % | 2021-01-25 |
| BIESS · Sustitución de hipoteca | BIESS (Banco del IESS) | 6,80 % | 25 años | 80 % | 2026-01-15 |
| Tu Casa Miti-Miti · VIP (Vivienda de Interés Público) al 4,99 % efectivo anual | MIT (Ministerio de Infraestructura y Tecnología, ex MIDUVI) | 4,88 % | 30 años | 95 % | 2026-03-23 |
| Tu Casa Miti-Miti · VIS (Vivienda de Interés Social) al 4,99 % efectivo anual | MIT (Ministerio de Infraestructura y Tecnología, ex MIDUVI) | 4,88 % | 30 años | 95 % | 2026-07-06 |
| Bono 'Yapa Pa' Tu Casa' · hasta 10.122 USD para la entrada | MIT (Ministerio de Infraestructura y Tecnología, ex MIDUVI) | — | 30 años | — | 2026-10-28 |
| Casa 100 · vivienda 100 % subsidiada | MIT (Ministerio de Infraestructura y Tecnología, ex MIDUVI) | — | — | 100 % | 2026-07-06 |
| Banco Pichincha · Crédito Hipotecario de vivienda (Habitar) \* | Banco Pichincha | 9,02 % | 20 años | 83 % | 2026-08-01 |
| Produbanco · Crédito Hipotecario | Produbanco | 10,09 % | 20 años | 80 % | 2026-04-01 |
| Banco del Pacífico · Hipoteca Pacífico | Banco del Pacífico | 7,50 % | 30 años | 80 % | 2026-10-01 |
| Banco Bolivariano · Credimax Hipotecario – compra de vivienda | Banco Bolivariano | 7,50 % | 20 años | 80 % | 2026-10-31 |
| Banco Internacional · Compra de vivienda | Banco Internacional | 8,79 % | 20 años | 80 % | 2026-10-31 |
| Banco ProCredit · Cartera inmobiliaria / Vivienda | Banco ProCredit | 8,62 % | 20 años | 80 % | 2026-11-01 |
| Banco General Rumiñahui · BGR Tu Casa (civil) | Banco General Rumiñahui | 7,60 % | 20 años | 80 % | 2026-10-31 |
| Mutualista Azuay · Crédito para casa nueva | Mutualista Azuay | 7,49 % | 20 años | 80 % | 2026-10-31 |
| Mutualista Imbabura · Mi Nueva Vivienda | Mutualista Imbabura | 8,74 % | 15 años | 80 % | 2026-11-01 |
| Cooperativa JEP · CrediMIVIVIENDA \* | Cooperativa JEP | 8,88 % | 20 años | 70 % | 2026-09-01 |
| Cooperativa Jardín Azuayo · Crédito de Vivienda | Cooperativa Jardín Azuayo | 8,65 % | 15 años | 80 % | 2026-10-31 |
| Cooperativa Andalucía · Crédito inmobiliario \* | Cooperativa Andalucía | 8,60 % | 16 años | 80 % | 2026-10-03 |
| Cooperativa Mushuc Runa · Impulso Inmobiliario \* | Cooperativa Mushuc Runa | 9,55 % | 20 años | 80 % | 2026-10-31 |
| Cooperativa Riobamba · Crédito vivienda | Cooperativa Riobamba | 8,70 % | 13 años | 80 % | 2026-11-01 |
| Cooperativa Atuntaqui · Credi Vivienda | Cooperativa Atuntaqui | 8,70 % | 20 años | 80 % | 2026-10-31 |
| Cooperativa Tulcán · Credi Vivienda | Cooperativa Tulcán | 8,50 % | 12 años | 80 % | 2026-10-31 |
| Cooperativa Pablo Muñoz Vega · Crédito Hipotecario (Vivienda) | Cooperativa Pablo Muñoz Vega | 8,79 % | 15 años | 80 % | 2026-10-01 |
| Cooperativa Vicentina Manuel Esteban Godoy (Mego) · Crédito con hipoteca \* | Cooperativa Vicentina Manuel Esteban Godoy (Mego) | 9,99 % | 20 años | 80 % | 2026-10-31 |
<!-- tabla:programas:fin -->

## Usar los datos

Sin instalar nada, desde cualquier lenguaje:

```
https://raw.githubusercontent.com/Vreinn-Tech/Credito-Hipotecario-Ecuador/main/data/programas.json
https://raw.githubusercontent.com/Vreinn-Tech/Credito-Hipotecario-Ecuador/main/data/entidades.json
```

Desde Node:

```js
import { programas, entidades } from 'credito-hipotecario-ecuador';
```

En un navegador, un Worker o un empaquetador (sin sistema de archivos):

```js
import programas from 'credito-hipotecario-ecuador/data/programas.json' with { type: 'json' };
```

## Proponer una corrección

¿Viste una tasa desactualizada o un requisito que cambió? Hacen falta dos cosas: **el enlace a la fuente oficial** y **la fecha del dato**.

- Sin programar: abre un issue en <https://github.com/Vreinn-Tech/Credito-Hipotecario-Ecuador/issues> indicando el producto, el campo, el valor actual, el valor correcto, la fuente y la fecha.
- Con un pull request: edita el registro, actualiza `fuenteUrl`, `fechaDato` y `verificado`, y ejecuta `npm run tablas` y `npm test`.

Los detalles están en [`CONTRIBUTING.md`](../CONTRIBUTING.md).
