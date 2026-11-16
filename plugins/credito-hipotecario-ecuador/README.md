# Crédito Hipotecario Ecuador

Plugin para Claude que responde preguntas sobre crédito de vivienda en Ecuador con datos y cálculos reales: una estimación orientativa de a qué créditos podría calificar una persona (BIESS, VIS/VIP Tu Casa Miti-Miti, bancos, cooperativas y mutualistas), cuánto pagaría al mes, cuánto le prestan según sus ingresos y qué requisitos y pasos tiene cada producto. Cada dato lleva su fuente oficial y su fecha.

## Instalación

En Claude Code:

```text
/plugin install credito-hipotecario-ecuador --marketplace Vreinn-Tech/Credito-Hipotecario-Ecuador
```

## Qué incluye

- **Conector MCP** `credito-hipotecario-ecuador`: el servidor remoto `https://creditohipotecarioecuador.com/mcp` (Streamable HTTP), público, sin cuenta ni clave y de solo lectura. Tiene 8 herramientas: `evaluar_perfil`, `simular_cuota`, `capacidad_de_credito`, `listar_programas`, `detalle_programa`, `listar_entidades`, `search` y `fetch`.
- **Skill** `credito-hipotecario-ecuador`: le indica a Claude qué herramienta usar, qué datos pedir y qué avisos incluir.

## Qué datos envía

Solo las cifras de cada consulta (por ejemplo, precio de la vivienda, ingreso y deudas mensuales, entrada, aportaciones al IESS, edad, monto, plazo y tasa) al servidor de creditohipotecarioecuador.com, que calcula la respuesta y no la guarda. No envía nombre, correo, identificación ni la conversación, y no ejecuta nada en tu equipo. Política de privacidad: https://creditohipotecarioecuador.com/legal/privacidad/

## Ejemplos

- «Gano 1.200 USD al mes, estoy afiliado al IESS con 48 aportaciones y quiero una casa de 70.000 USD. ¿A qué crédito califico?»
- «¿Cuánto pagaría al mes por 65.000 USD a 30 años con CrediCasa del BIESS?»
- «¿Qué cooperativas dan crédito de vivienda en Loja?»

## Aviso

Los resultados son orientativos y referenciales: se calculan con las reglas públicas de cada producto, sin consultar buró de crédito ni datos personales. No son una evaluación de solvencia, una oferta ni una aprobación de crédito, ni asesoría financiera, y no deben usarse para decidir sobre el crédito de una persona. Confirma tasas, requisitos y condiciones con la entidad. Soporte: contacto@creditohipotecarioecuador.com · Licencia: MIT.
```
