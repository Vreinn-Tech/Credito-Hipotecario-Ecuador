---
name: credito-hipotecario-ecuador
description: Evalúa, simula y compara crédito hipotecario en Ecuador (BIESS, CrediCasa, VIS/VIP, Miti-Miti, bancos, cooperativas). Úsala ante preguntas sobre financiar vivienda, cuotas, entrada o requisitos.
---

# Crédito hipotecario en Ecuador

Responde preguntas sobre crédito de vivienda en Ecuador con los datos y el motor de elegibilidad de creditohipotecarioecuador.com, a través de las herramientas del servidor MCP `credito-hipotecario-ecuador`. Los montos van en USD.

## Cuándo usarla

Cuando alguien pregunte por financiar una vivienda en Ecuador: a qué crédito califica, cuánto le prestan, cuánto pagaría al mes, cuánta entrada necesita, o por BIESS, CrediCasa, VIS/VIP, Tu Casa Miti-Miti, bonos de vivienda, bancos, cooperativas o mutualistas. No la uses para otros países ni para créditos que no sean de vivienda.

## Qué herramienta usar

| La persona quiere… | Herramienta | Datos necesarios |
| --- | --- | --- |
| Saber a qué créditos califica o comparar opciones para su caso | `evaluar_perfil` | `precioVivienda`, `ingresoMensual` |
| La cuota de un monto, plazo y tasa (o de un producto concreto) | `simular_cuota` | `monto`, `plazoAnios` y `tasaNominalAnual` o `programa` (slug) |
| Cuánto le prestan según sus ingresos | `capacidad_de_credito` | `ingresoMensual`, `tasaNominalAnual`, `plazoAnios` |
| Comparar tasas, ver qué ofrece una entidad, ver bonos y subsidios | `listar_programas` | filtros opcionales: `categoria`, `entidad`, `uso` |
| Requisitos, ventajas y pasos de un producto | `detalle_programa` | `slug` (sale de `listar_programas` o `evaluar_perfil`) |
| Qué entidades operan en una provincia o de un tipo | `listar_entidades` | filtros opcionales: `tipo`, `provincia` |

Nunca respondas tasas, requisitos ni cuotas de memoria: cambian, y los de la base llevan fecha y fuente.

## Datos del perfil

`evaluar_perfil` solo exige el precio de la vivienda y el ingreso mensual neto del hogar. Si falta alguno, pídelo antes de llamar.

El resto tiene valores por defecto conservadores que cambian mucho el resultado. Pregúntalos en un solo mensaje breve, sin interrogar:

- ¿Está afiliado al IESS y cuántas aportaciones tiene? (`afiliadoIess`, `aportaciones`; sin esto quedan fuera los créditos del BIESS)
- ¿Cuánto tiene ahorrado para la entrada? (`entradaDisponible`, por defecto 0)
- ¿Qué edad tiene? (`edad`, por defecto 35; limita el plazo)
- Si compra vivienda terminada (o le interesan CrediCasa o Tu Casa Miti-Miti): ¿la vivienda es nueva de primer uso o usada? (`viviendaNueva: true` o `false`). Esos productos solo financian vivienda nueva: si no se sabe, salen «condicional» con la observación de confirmarlo; si es usada, «no apto».

Pasa también lo que la persona ya haya dicho: `deudasMensuales`, `uso` (`vivienda_terminada`, `construccion`, `terreno`, `remodelacion`, `sustitucion`, `vis_vip`), `primeraVivienda`, `relacionLaboral` (`dependiente`, `independiente`, `jubilado`, `migrante`), `plazoDeseado` y `viviendaNueva`. Si el plazo que pide es menor que el mínimo de un producto, la cuota de ese producto se calcula con el plazo mínimo y lo indica en las observaciones. No inventes datos: omite lo que no sepas y di qué valores se asumieron.

Si la persona quiere una respuesta ya, evalúa con lo que haya y ofrece afinar. No pidas cédula, nombres ni otros datos que identifiquen a alguien: no hacen falta.

## Cómo presentar el resultado

1. Una línea con el perfil evaluado, incluidos los valores asumidos.
2. Una tabla con las mejores opciones (de 3 a 6), en el orden que devuelve la herramienta:

   | Producto y entidad | Elegibilidad | Cuota estimada | Monto y plazo | Entrada requerida | Observaciones | Fecha del dato y fuente |
   | --- | --- | --- | --- | --- | --- | --- |

   - Elegibilidad: apto, condicional o no apto. «Condicional» significa que califica si cumple lo que dicen las observaciones (`razones`); cópialas sin suavizarlas.
   - Fuente: enlaza `fuenteUrl` (oficial) o `url` (ficha) y pon `fechaDato`. Marca como «preliminar» los productos con `verificado: false`.
3. Qué puede hacer para mejorar el resultado, según las observaciones: más entrada, más plazo o una vivienda de menor precio. Si una observación pide confirmar que la vivienda es nueva y no lo preguntaste, pregúntalo y vuelve a evaluar.
4. Si no califica a nada, repite la llamada con `incluirNoAptos: true` y explica los motivos.

La cuota incluye capital e interés; no incluye seguros de desgravamen e incendio ni gastos legales. Dilo al dar una cuota. Los bonos y subsidios no pasan por `evaluar_perfil`: consúltalos con `listar_programas` y `categoria: "subsidio"`.

## Avisos obligatorios

Termina toda respuesta que incluya tasas, cuotas o elegibilidad con estas dos cosas:

- El aviso: la información es referencial y tiene fecha; no es una oferta de crédito ni asesoría financiera; hay que verificar tasas, requisitos y condiciones con la entidad antes de decidir. La aprobación depende del análisis de cada entidad (buró de crédito, avalúo, estabilidad laboral).
- El enlace a la evaluación completa y gratuita: https://creditohipotecarioecuador.com/evaluacion/

## Si las herramientas MCP no están disponibles

Dilo y ofrece una de estas dos salidas:

- Con terminal y Node.js 18 o superior, usa el CLI (añade `--json` para leer la salida):

  ```bash
  npx -y github:Vreinn-Tech/Credito-Hipotecario-Ecuador evaluar --precio 70000 --ingreso 1200 --entrada 5000 --iess --aportaciones 48 --nueva
  npx -y github:Vreinn-Tech/Credito-Hipotecario-Ecuador cuota --monto 65000 --tasa 2.99 --plazo 20
  npx -y github:Vreinn-Tech/Credito-Hipotecario-Ecuador programas --categoria publico
  npx -y github:Vreinn-Tech/Credito-Hipotecario-Ecuador programa biess-credicasa
  npx -y github:Vreinn-Tech/Credito-Hipotecario-Ecuador --help
  ```

- Sin terminal, indica cómo conectar el servidor MCP `https://creditohipotecarioecuador.com/mcp` (sin cuenta, solo lectura) como conector personalizado, o envía a la persona a https://creditohipotecarioecuador.com/evaluacion/

No sustituyas las herramientas por cifras de memoria.
