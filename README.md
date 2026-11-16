# Crédito Hipotecario Ecuador: código y datos abiertos

Librería de JavaScript, herramienta de línea de comandos (CLI), servidor MCP y **datos abiertos** en JSON sobre el crédito de vivienda en Ecuador: BIESS, programas VIS/VIP, bancos, cooperativas y mutualistas. Sin dependencias.

Es el código fuente del motor de elegibilidad de [creditohipotecarioecuador.com](https://creditohipotecarioecuador.com), el comparador de crédito hipotecario de Ecuador. Este repositorio es para desarrolladores, analistas y asistentes de IA; si lo que buscas es un crédito, ve a [¿Buscas un crédito y no el código?](#buscas-un-crédito-y-no-el-código)

- **Datos abiertos (CC BY 4.0)**: 28 productos y 39 instituciones, con fuente y fecha por registro: [`programas.json`](data/programas.json), [`entidades.json`](data/entidades.json) y [diccionario de datos](data/README.md)
- **Servidor MCP**: `https://creditohipotecarioecuador.com/mcp` ([referencia](docs/mcp.md))
- **Documentación y demo técnica**: <https://vreinn-tech.github.io/Credito-Hipotecario-Ecuador/>
- **Sitio**: <https://creditohipotecarioecuador.com>

> **Aviso.** Información referencial: no es una oferta de crédito ni asesoría financiera. Las tasas cambian. Ver el [aviso legal](#aviso-legal).

## Qué calcula el motor

A partir de un perfil (precio de la vivienda, ingresos y unos pocos datos más), devuelve para cada producto:

- la elegibilidad: **apto**, **condicional** (con algún ajuste) o **no apto**, con las razones;
- el monto financiable, la cuota mensual estimada, el plazo y la entrada mínima;
- un puntaje de 0 a 100 para ordenar las opciones.

## ¿Buscas un crédito y no el código?

No necesitas instalar nada. Las herramientas para el público están en el sitio, son gratuitas y usan estos mismos datos:

- [¿A qué crédito de vivienda calificas?](https://creditohipotecarioecuador.com/evaluacion/): evaluación de perfil en 2 minutos, con asesoría gratuita.
- [Comparador de créditos hipotecarios](https://creditohipotecarioecuador.com/comparador/): tasas, plazos y financiamiento lado a lado.
- [Simulador de crédito hipotecario](https://creditohipotecarioecuador.com/simulador/): cuota mensual y tabla de amortización.
- [Fichas de cada programa](https://creditohipotecarioecuador.com/programas/): requisitos, ventajas, desventajas y fuente oficial de cada producto.

## Inicio rápido

Necesitas [Node.js](https://nodejs.org) 18 o superior. Sin instalar nada:

```bash
npx github:Vreinn-Tech/Credito-Hipotecario-Ecuador evaluar --precio 70000 --ingreso 1200 --entrada 5000 --iess --aportaciones 48
```

```text
Perfil evaluado
  Vivienda: $70.000 · compra de vivienda terminada
  Entrada disponible: $5.000 · Ingreso: $1.200/mes · Otras deudas: $0/mes
  IESS: afiliado, 48 aportaciones · Edad: 35 · Plazo deseado: 20 años
  Primera vivienda: sí · Relación laboral: dependiente

Resultado: 2 apto(s), 16 condicional(es) y 8 no apto(s) de 26 productos.

 #  Producto                                Entidad                     Resultado    Puntaje      Tasa    Plazo    Monto  Cuota/mes  Entrada mín.
──  ──────────────────────────────────────  ──────────────────────────  ───────────  ───────  ────────  ───────  ───────  ─────────  ────────────
 1  BIESS · CrediCasa 2,99 %                BIESS (Banco del IESS)      Apto              91    2,99 %  20 años  $65.000       $360            $0
 2  Tu Casa Miti-Miti · VIS (Vivienda de …  MIT (Ministerio de Infrae…  Apto              81    4,88 %  20 años  $65.000       $425        $3.500
 3  BIESS · Vivienda terminada (nueva o u…  BIESS (Banco del IESS)      Condicional       59    6,80 %  20 años  $65.000       $496        $3.500
 …

Observaciones
  3. BIESS · Vivienda terminada (nueva o usada) — Condicional
     - La cuota (≈ 496 USD) superaría el 40 % de tu ingreso disponible. Podrías aumentar la entrada o el plazo.
  …

Más detalle y asesoría gratuita: https://creditohipotecarioecuador.com/evaluacion/
```

(Salida con los datos de la versión 0.1.0; cambia cuando se actualizan las tasas.)

### Comandos

| Comando | Qué hace |
| --- | --- |
| `evaluar` | Evalúa un perfil contra todos los productos y los ordena de mejor a peor. |
| `cuota` | Calcula la cuota mensual; con `--tabla`, la tabla de amortización completa. |
| `programas` | Lista los productos con tasa, plazo y financiamiento. Filtros: `--categoria`, `--entidad`. |
| `programa <slug>` | Muestra la ficha completa de un producto. |
| `entidades` | Lista las instituciones. Filtro: `--tipo`. |

Opciones de `evaluar`:

| Opción | Significado | Por defecto |
| --- | --- | --- |
| `--precio <usd>` | Precio o avalúo de la vivienda | obligatorio |
| `--ingreso <usd>` | Ingreso neto mensual del hogar | obligatorio |
| `--entrada <usd>` | Ahorro disponible para la entrada | 0 |
| `--deudas <usd>` | Cuotas mensuales de otras deudas | 0 |
| `--iess` | Eres afiliado o jubilado del IESS | no afiliado |
| `--aportaciones <n>` | Meses de aportación al IESS | 0 |
| `--edad <años>` | Edad del solicitante | 35 |
| `--uso <uso>` | `vivienda_terminada`, `construccion`, `terreno`, `remodelacion`, `sustitucion` o `vis_vip` | `vivienda_terminada` |
| `--plazo <años>` | Plazo deseado | 20 |
| `--segunda-vivienda` | Ya tienes una vivienda | primera vivienda |
| `--relacion <tipo>` | `dependiente`, `independiente`, `jubilado` o `migrante` | `dependiente` |
| `--nueva` / `--usada` | La vivienda es nueva de primer uso o usada | no se sabe |
| `--todos` | Incluye los productos a los que no calificas, con el motivo | solo aptos y condicionales |
| `--json` | Salida en JSON (todos los comandos) | texto |

Los montos se escriben sin separador de miles (`70000`, no `70.000`). Más ejemplos:

```bash
npx github:Vreinn-Tech/Credito-Hipotecario-Ecuador cuota --monto 65000 --tasa 2.99 --plazo 30
npx github:Vreinn-Tech/Credito-Hipotecario-Ecuador programas --categoria publico
npx github:Vreinn-Tech/Credito-Hipotecario-Ecuador programa biess-credicasa
npx github:Vreinn-Tech/Credito-Hipotecario-Ecuador --help
```

## Uso como librería

```bash
npm install github:Vreinn-Tech/Credito-Hipotecario-Ecuador
```

```js
import { evaluarPerfil, cuotaMensual, fmtUSD } from 'credito-hipotecario-ecuador';

// Solo son obligatorios precioVivienda e ingresoMensual; el resto tiene valores por defecto.
const resultados = evaluarPerfil({
  precioVivienda: 65000,
  ingresoMensual: 1200,
  afiliadoIess: true,
  aportaciones: 48,
  plazoDeseado: 30,
});

const mejor = resultados[0];
console.log(mejor.programa.nombre);         // "BIESS · CrediCasa 2,99 %"
console.log(mejor.elegibilidad);            // "apto"
console.log(mejor.score);                   // 100
console.log(fmtUSD(mejor.cuotaEstimada));   // "$274"

cuotaMensual({ monto: 65000, tasaNominalAnual: 2.99, plazoAnios: 30 }); // 273.69…
```

Funciones principales:

| Función | Qué hace |
| --- | --- |
| `evaluarPerfil(parcial)` | `normalizarPerfil` + `evaluarTodos` sobre los productos del paquete. |
| `normalizarPerfil(parcial)` | Valida y completa un perfil; lanza un `Error` con mensaje en español si algo no cuadra. |
| `evaluarTodos(programas, perfil)` | Evalúa una lista de productos y la devuelve ordenada. No incluye los subsidios. |
| `evaluarPrograma(programa, perfil)` | Evalúa un producto. |
| `cuotaMensual`, `tablaAmortizacion`, `tasaEfectiva`, `capacidadDeCredito` | Cálculo financiero. |
| `programas`, `entidades`, `buscarPrograma(slug)`, `buscarEntidad(slug)` | Acceso a los datos. |
| `fmtUSD`, `fmtPct` | Formato de dólares y porcentajes para Ecuador. |

Incluye tipos de TypeScript (`Programa`, `Entidad`, `PerfilUsuario`, `ResultadoPrograma`, `Elegibilidad`, `Uso`, `Categoria`).

### En navegadores, Workers y otros entornos sin sistema de archivos

La entrada principal lee los JSON del disco, así que solo funciona en Node. El motor y las fórmulas son código puro y se importan por separado:

```js
import { evaluarTodos, normalizarPerfil } from 'credito-hipotecario-ecuador/evaluacion';
import { cuotaMensual } from 'credito-hipotecario-ecuador/finanzas';
import programas from 'credito-hipotecario-ecuador/data/programas.json' with { type: 'json' };

const resultados = evaluarTodos(programas, normalizarPerfil({ precioVivienda: 90000, ingresoMensual: 1800 }));
```

### Solo los datos

Los JSON se pueden usar desde cualquier lenguaje, sin instalar el paquete:

```
https://raw.githubusercontent.com/Vreinn-Tech/Credito-Hipotecario-Ecuador/main/data/programas.json
https://raw.githubusercontent.com/Vreinn-Tech/Credito-Hipotecario-Ecuador/main/data/entidades.json
```

El significado de cada campo, las unidades y la tabla con los 28 productos están en [`data/README.md`](data/README.md). Los datos tienen licencia CC BY 4.0: al usarlos, indica «Fuente: [creditohipotecarioecuador.com](https://creditohipotecarioecuador.com)».

## Cómo funciona el motor

El código está en [`src/evaluacion.js`](src/evaluacion.js) y [`src/finanzas.js`](src/finanzas.js): menos de 200 líneas sin dependencias. Para cada producto, el motor compara tu perfil con la ficha del producto y acumula **razones**. Hay dos clases de regla.

### Reglas de bloqueo: el resultado es «no apto»

Basta una para descartar el producto, y el puntaje queda en 0:

1. El producto no financia el destino que buscas (`usos`). Excepción: si buscas `vivienda_terminada`, también valen los productos VIS/VIP.
2. El producto exige afiliación al IESS y no eres afiliado.
3. El producto exige afiliación y tienes menos aportaciones que `aportacionesMinimas`.
4. Es solo para primera vivienda y ya tienes una.
5. Es solo para vivienda nueva y la tuya es usada. Si no indicas si es nueva o usada, esta regla no bloquea.
6. El precio de la vivienda supera `precioViviendaMaxUsd`.
7. El precio está por debajo de `precioViviendaMinUsd` (segmento VIP).
8. Tu ingreso mensual supera `ingresoMaxUsd`.
9. Tu edad es menor que `edadMin`.
10. Por edad no alcanzas el plazo mínimo: `edadMax − edad` es menor que `plazoMinAnios` (3 años si el producto no lo indica).
11. La cuota estimada supera en más de un 40 % el límite del producto: `cuota / ingreso disponible > 1,4 × ratioCuotaIngreso`.

### Reglas de condición: el resultado es «condicional»

Calificas, pero con un ajuste o un requisito adicional:

- **Plazo recortado por edad**: si `edadMax − edad` es menor que el plazo que pediste, el plazo se reduce a ese valor.
- **Entrada insuficiente**: tu entrada disponible es menor que la entrada mínima del producto.
- **Monto máximo**: lo que necesitas supera `montoMaxUsd`; el monto se recorta a ese tope y tendrías que cubrir la diferencia.
- **Monto mínimo**: lo que necesitas es menor que `montoMinUsd`.
- **Cuota ajustada**: la cuota supera el límite cuota/ingreso del producto, pero por no más de un 40 %.
- **Independiente**: tendrás que justificar ingresos (RUC, declaraciones, movimientos bancarios).
- **Migrante** en un producto de categoría `publico`: hay que verificar el programa para ecuatorianos en el exterior.

Si no se activa ninguna regla, el resultado es **apto**. Un bloqueo siempre prevalece sobre una condición.

### Cómo se calculan el monto y la cuota

1. **Plazo**: el menor entre el que pides y `plazoMaxAnios` (25 si el producto no lo indica), recortado por edad si hace falta.
2. **Porcentaje financiable**: si el producto tiene `tramos`, el del primer tramo cuyo `hastaUsd` sea igual o mayor que el precio; si no, `financiamientoMaxPct` (80 % si no está publicado).
3. **Entrada requerida** = precio − precio × porcentaje financiable.
4. **Monto financiable** = el menor entre lo que necesitas (precio − tu entrada) y lo que el producto financia (precio × porcentaje), con el tope de `montoMaxUsd`.
5. **Cuota estimada**: sistema francés con `tasaNominal` (10 % si el producto no publica tasa).
6. **Ingreso disponible** = ingreso mensual − otras deudas (nunca menor que 0).
7. **Relación cuota/ingreso** = cuota ÷ ingreso disponible (se toma 1 si el ingreso disponible es 0).
8. **Capacidad máxima**: el crédito más alto cuya cuota cabe en `ingreso disponible × ratioCuotaIngreso`, a esa tasa y plazo.

### Sistema francés

Todas las cuotas se calculan con el sistema francés (cuota fija) y capitalización mensual:

```
i = tasa nominal anual / 100 / 12        (tasa mensual)
n = plazo en años × 12                   (número de cuotas)

cuota = monto × i / (1 − (1 + i)^−n)     (si i = 0: cuota = monto / n)
```

En cada cuota, el interés es `saldo × i` y el resto amortiza capital, de modo que al principio se paga sobre todo interés y al final sobre todo capital. La tasa efectiva anual equivalente es `((1 + i)^12 − 1) × 100`. Ejemplo: 65.000 USD al 2,99 % a 30 años dan una cuota de 273,69 USD y una tasa efectiva del 3,03 %.

### Fórmula del puntaje

Los productos no aptos tienen puntaje 0. Los demás parten de 100 y pierden puntos por cuatro conceptos:

| Concepto | Descuento | Máximo |
| --- | --- | ---: |
| Holgura de la cuota | `(relación cuota/ingreso ÷ ratioCuotaIngreso − 0,6) × 60`, solo si es positivo | 40 |
| Costo de la tasa | `(tasaNominal − 4,5) × 4`, solo si es positivo | 30 |
| Observaciones | 6 por cada razón acumulada | 20 |
| Dato preliminar | 2 si el producto tiene `verificado: false` | 2 |

El resultado se redondea al entero más cercano y nunca baja de 0. Dicho de otro modo: una cuota que usa menos del 60 % del límite del producto no resta; una tasa de hasta el 4,5 % no resta; cada observación pesa 6 puntos.

La lista se ordena por puntaje de mayor a menor y, en caso de empate, por cuota de menor a mayor. Los productos de categoría `subsidio` (bonos) no se evalúan: no son créditos.

### Límites del modelo

Es una estimación para orientarse, no una precalificación:

- La cuota incluye solo capital e interés: no incluye seguros de desgravamen e incendio ni gastos legales, de avalúo o de escrituración.
- Se usa una tasa de referencia por producto. Algunas entidades aplican tasas distintas según el monto, el plazo o el perfil (lo explica el campo `tasaNota`).
- No se consulta el buró de crédito ni se valida la estabilidad laboral, que las entidades sí revisan.
- Si el precio de la vivienda supera el último tramo de un producto con `tramos`, se aplica `financiamientoMaxPct`; en ese caso el monto queda acotado por `montoMaxUsd`.

## Instituciones

Las 39 instituciones de [`data/entidades.json`](data/entidades.json). «Productos con ficha» cuenta los productos de esa institución en `programas.json`; las que muestran «—» figuran como directorio. Tabla generada con `npm run tablas`.

<!-- tabla:entidades:inicio -->
| Institución | Slug | Tipo | Productos con ficha | Cobertura |
| --- | --- | --- | ---: | --- |
| [BIESS (Banco del IESS)](https://www.biess.fin.ec) | `biess` | Pública | 6 | Nacional |
| [MIT (Ministerio de Infraestructura y Tecnología, ex MIDUVI)](https://www.mit.gob.ec/miti-miti/) | `mit` | Pública | 4 | Nacional |
| [Banco Pichincha](https://www.pichincha.com) | `banco-pichincha` | Banco | 1 | Nacional |
| [Banco Guayaquil](https://www.bancoguayaquil.com) | `banco-guayaquil` | Banco | — | Nacional |
| [Produbanco](https://www.produbanco.com.ec) | `produbanco` | Banco | 1 | Nacional |
| [Banco del Pacífico](https://www.bancodelpacifico.com) | `banco-pacifico` | Banco | 1 | Nacional |
| [Banco Bolivariano](https://www.bolivariano.com) | `banco-bolivariano` | Banco | 1 | Nacional |
| [Banco Internacional](https://www.bancointernacional.com.ec) | `banco-internacional` | Banco | 1 | Nacional |
| [Banco del Austro](https://www.bancodelaustro.com) | `banco-austro` | Banco | — | Nacional |
| [Banco de Machala](https://www.bancomachala.com) | `banco-machala` | Banco | — | el-oro, guayas |
| [Banco Solidario](https://www.banco-solidario.com) | `banco-solidario` | Banco | — | Nacional |
| [Banco ProCredit](https://www.bancoprocredit.com.ec) | `banco-procredit` | Banco | 1 | pichincha |
| [Banco General Rumiñahui](https://www.bgr.com.ec) | `bgr` | Banco | 1 | Nacional |
| [Banco de Loja](https://www.bancodeloja.fin.ec) | `banco-loja` | Banco | — | loja, zamora-chinchipe, el-oro |
| [Banco Amazonas](https://www.bancoamazonas.com) | `banco-amazonas` | Banco | — | guayas, pichincha |
| [Mutualista Pichincha](https://www.mutualistapichincha.com) | `mutualista-pichincha` | Mutualista | — | Nacional |
| [Mutualista Azuay](https://www.mutualistaazuay.com) | `mutualista-azuay` | Mutualista | 1 | azuay |
| [Mutualista Imbabura](https://www.mutualistaimbabura.com) | `mutualista-imbabura` | Mutualista | 1 | imbabura, pichincha |
| [Mutualista Ambato](https://www.mutualistaambato.fin.ec) | `mutualista-ambato` | Mutualista | — | tungurahua |
| [Cooperativa JEP](https://www.jep.coop) | `jep` | Cooperativa | 1 | azuay, canar, guayas, el-oro, loja, morona-santiago, pichincha |
| [Cooperativa Jardín Azuayo](https://www.jardinazuayo.fin.ec) | `jardin-azuayo` | Cooperativa | 1 | azuay, canar, morona-santiago, el-oro, loja |
| [Cooperativa 29 de Octubre](https://www.29deoctubre.fin.ec) | `29-de-octubre` | Cooperativa | — | Nacional |
| [Cooprogreso](https://www.cooprogreso.fin.ec) | `cooprogreso` | Cooperativa | — | pichincha |
| [Cooperativa Alianza del Valle](https://www.alianzadelvalle.fin.ec) | `alianza-del-valle` | Cooperativa | — | pichincha |
| [Cooperativa Policía Nacional](https://www.cpn.fin.ec) | `cpn` | Cooperativa | — | Nacional |
| [Cooperativa Oscus](https://www.oscus.coop) | `oscus` | Cooperativa | — | tungurahua |
| [Cooperativa San Francisco (SanFra)](https://coac-sanfra.com) | `san-francisco` | Cooperativa | — | tungurahua |
| [CACPECO](https://www.cacpeco.com) | `cacpeco` | Cooperativa | — | cotopaxi |
| [Cooperativa Andalucía](https://andalucia.fin.ec) | `andalucia` | Cooperativa | 1 | pichincha |
| [Cooperativa Mushuc Runa](https://mushucruna.com) | `mushuc-runa` | Cooperativa | 1 | tungurahua |
| [Cooperativa Riobamba](https://www.cooprio.fin.ec) | `riobamba` | Cooperativa | 1 | chimborazo, pichincha, azuay |
| [Cooperativa Atuntaqui](https://www.atuntaqui.fin.ec) | `atuntaqui` | Cooperativa | 1 | imbabura, pichincha, carchi |
| [Cooperativa El Sagrario](https://cooperativaelsagrario.com) | `el-sagrario` | Cooperativa | — | tungurahua, cotopaxi |
| [Cooperativa Tulcán](https://www.cooptulcan.fin.ec) | `tulcan` | Cooperativa | 1 | carchi, imbabura, pichincha |
| [Cooperativa Pablo Muñoz Vega](https://www.cpmv.fin.ec) | `pablo-munoz-vega` | Cooperativa | 1 | carchi, imbabura, pichincha |
| [Cooperativa Santa Rosa](https://www.coopsantarosa.fin.ec) | `santa-rosa` | Cooperativa | — | el-oro |
| [Cooperativa Vicentina Manuel Esteban Godoy (Mego)](https://mego.com.ec) | `mego` | Cooperativa | 1 | loja, zamora-chinchipe |
| [CACPE Biblián](https://www.cacpebiblian.fin.ec) | `cacpe-biblian` | Cooperativa | — | canar |
| [CACPE Pastaza](https://www.cacpepas.fin.ec) | `cacpe-pastaza` | Cooperativa | — | pastaza |
<!-- tabla:entidades:fin -->

Las tasas, los plazos y la fecha de cada dato están en la [tabla de productos](data/README.md#resumen-de-los-28-productos) y, para comparar en línea, en el [comparador](https://creditohipotecarioecuador.com/comparador/).

## Servidor MCP

El paquete incluye un servidor [MCP](https://modelcontextprotocol.io) para que asistentes de IA consulten los datos y evalúen perfiles.

- **Remoto**: `https://creditohipotecarioecuador.com/mcp`
- **Local**: `npx -y github:Vreinn-Tech/Credito-Hipotecario-Ecuador credito-hipotecario-ecuador-mcp`

La configuración y las herramientas disponibles están en [`docs/mcp.md`](docs/mcp.md).

## Usarlo en Claude

En Claude Code, instala el plugin (servidor MCP + skill):

    /plugin install credito-hipotecario-ecuador --marketplace Vreinn-Tech/Credito-Hipotecario-Ecuador

o solo el servidor MCP:

    claude mcp add --transport http credito-hipotecario-ecuador https://creditohipotecarioecuador.com/mcp

En claude.ai y Claude Desktop, añade `https://creditohipotecarioecuador.com/mcp` como conector personalizado (Customize > Connectors). Pasos, skill para subir y servidor local en [`docs/claude.md`](docs/claude.md). Para ChatGPT, ver [`docs/mcp.md`](docs/mcp.md).

¿No programas? La [guía para conectar Claude o ChatGPT](https://creditohipotecarioecuador.com/asistentes-ia/) lo explica menú por menú.

## Desarrollo

```bash
git clone https://github.com/Vreinn-Tech/Credito-Hipotecario-Ecuador.git
cd credito-hipotecario-ecuador
npm test            # node --test, sin instalar nada
npm run tablas      # regenera las tablas de la documentación tras cambiar los datos
```

¿Encontraste una tasa desactualizada? Lee [`CONTRIBUTING.md`](CONTRIBUTING.md): hacen falta la fuente oficial y la fecha del dato. Los cambios de cada versión están en [`CHANGELOG.md`](CHANGELOG.md).

## Aviso legal

- La información de este repositorio es **referencial**. No es una oferta de crédito, una precalificación ni asesoría financiera, legal o tributaria.
- Las **tasas y condiciones cambian** sin previo aviso. Cada registro indica la fecha de su dato en `fechaDato` y su origen en `fuenteUrl`; los registros con `verificado: false` son preliminares.
- **Verifica siempre con cada entidad** las condiciones vigentes antes de tomar una decisión. La aprobación de un crédito depende exclusivamente de la entidad que lo otorga.
- Los resultados del evaluador son estimaciones basadas en reglas simplificadas (ver [Límites del modelo](#límites-del-modelo)).
- Este proyecto es independiente: no está afiliado al BIESS, al MIT ni a ninguna de las instituciones financieras mencionadas. Los nombres y marcas pertenecen a sus titulares.
- El software y los datos se ofrecen «tal cual», sin garantías de ningún tipo.

## Licencias

- **Código**: [MIT](LICENSE).
- **Datos** (carpeta `data/`): [CC BY 4.0](LICENSE-DATA.md). Atribución requerida: «Fuente: [creditohipotecarioecuador.com](https://creditohipotecarioecuador.com)».

## Enlaces

- [creditohipotecarioecuador.com](https://creditohipotecarioecuador.com): comparador de crédito de vivienda en Ecuador
- [Evaluación de perfil gratuita](https://creditohipotecarioecuador.com/evaluacion/)
- [Comparar tasas de crédito hipotecario](https://creditohipotecarioecuador.com/comparador/)
- [Calcular la cuota de un crédito de vivienda](https://creditohipotecarioecuador.com/simulador/)
- [Mejor crédito hipotecario de Ecuador por perfil](https://creditohipotecarioecuador.com/mejor-credito-hipotecario-ecuador/)
- [Préstamo hipotecario BIESS: requisitos y tasas](https://creditohipotecarioecuador.com/biess/)
- [Usar los datos en Claude o ChatGPT](https://creditohipotecarioecuador.com/asistentes-ia/)
- [Documentación y demo técnica](https://vreinn-tech.github.io/Credito-Hipotecario-Ecuador/)

## In English

Open-source eligibility engine, mortgage payment calculator and open dataset for **home loans in Ecuador** (BIESS, subsidised VIS/VIP programmes, banks, credit unions and mutual associations). It is the engine behind [creditohipotecarioecuador.com](https://creditohipotecarioecuador.com), packaged as a zero-dependency JavaScript library, a CLI and an MCP server.

```bash
npx github:Vreinn-Tech/Credito-Hipotecario-Ecuador evaluar --precio 70000 --ingreso 1200 --entrada 5000 --iess --aportaciones 48
```

Given a home price, household income and a few other inputs, it classifies each of the 26 loan products as eligible (`apto`), conditionally eligible (`condicional`) or not eligible (`no_apto`), explains why, and estimates the loan amount, monthly payment and down payment. Output, field names and documentation are in Spanish. The dataset is documented in [`data/README.md`](data/README.md).

Reference information only: not a credit offer or financial advice. Rates change; check each record's `fechaDato` and confirm with the lender. Code is MIT; data is CC BY 4.0 with attribution to creditohipotecarioecuador.com.
