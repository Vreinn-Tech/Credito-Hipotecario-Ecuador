import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import * as paquete from '../src/index.js';
import { programas, entidades, buscarPrograma, buscarEntidad } from '../src/datos.js';
import { tasaEfectiva } from '../src/finanzas.js';
import { USOS } from '../src/evaluacion.js';
import { tablasDesactualizadas } from '../scripts/generar-tablas.mjs';

const leer = (ruta) => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8');
const leerJson = (ruta) => JSON.parse(leer(ruta));

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const HOY = new Date().toISOString().slice(0, 10);

function esFechaValida(s) {
  if (!FECHA_ISO.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

const duplicados = (lista) => lista.filter((x, i) => lista.indexOf(x) !== i);

// ---------- acceso ----------

test('datos: se cargan 28 productos y 39 entidades', () => {
  assert.equal(programas.length, 28);
  assert.equal(entidades.length, 39);
});

test('buscarPrograma y buscarEntidad', () => {
  assert.equal(buscarPrograma('biess-credicasa').entidad, 'biess');
  assert.equal(buscarEntidad('biess').tipo, 'publico');
  assert.equal(buscarPrograma('no-existe'), undefined);
  assert.equal(buscarEntidad('no-existe'), undefined);
  assert.equal(buscarPrograma(), undefined);
});

test('index.js reexporta finanzas, evaluación y datos', () => {
  const esperadas = [
    'cuotaMensual', 'tablaAmortizacion', 'tasaEfectiva', 'capacidadDeCredito', 'fmtUSD', 'fmtPct',
    'evaluarPrograma', 'evaluarTodos', 'normalizarPerfil', 'USOS', 'RELACIONES_LABORALES',
    'programas', 'entidades', 'buscarPrograma', 'buscarEntidad', 'evaluarPerfil',
  ];
  for (const nombre of esperadas) assert.ok(nombre in paquete, `falta la exportación ${nombre}`);
  assert.equal(paquete.programas, programas);
});

test('los módulos puros no importan nada de Node', () => {
  for (const archivo of ['src/finanzas.js', 'src/evaluacion.js']) {
    const codigo = leer(archivo);
    assert.ok(!/from\s+['"]node:/.test(codigo), `${archivo} no debe importar módulos de Node`);
    assert.ok(!/datos\.js/.test(codigo), `${archivo} no debe depender de datos.js`);
  }
});

// ---------- integridad ----------

test('integridad: slugs únicos y bien formados', () => {
  assert.deepEqual(duplicados(programas.map((p) => p.slug)), []);
  assert.deepEqual(duplicados(entidades.map((e) => e.slug)), []);
  for (const x of [...programas, ...entidades]) assert.match(x.slug, SLUG);
});

test('integridad: cada programa.entidad existe en entidades.json', () => {
  const slugs = new Set(entidades.map((e) => e.slug));
  for (const p of programas) assert.ok(slugs.has(p.entidad), `${p.slug}: la entidad "${p.entidad}" no existe`);
});

test('integridad: campos obligatorios de cada producto', () => {
  const textos = ['slug', 'nombre', 'entidad', 'categoria', 'resumen', 'descripcion', 'paraQuien', 'fuenteUrl', 'fechaDato'];
  const numeroONulo = ['tasaNominal', 'tasaEfectiva', 'plazoMinAnios', 'plazoMaxAnios', 'financiamientoMaxPct', 'entradaMinPct', 'montoMinUsd', 'montoMaxUsd', 'precioViviendaMaxUsd', 'edadMin', 'edadMax'];
  const booleanos = ['requiereAfiliacionIess', 'soloPrimeraVivienda', 'verificado'];
  const listas = ['usos', 'requisitos', 'ventajas', 'desventajas'];
  for (const p of programas) {
    for (const c of textos) assert.ok(typeof p[c] === 'string' && p[c].trim() !== '', `${p.slug}.${c} debe ser un texto no vacío`);
    for (const c of numeroONulo) assert.ok(p[c] === null || (typeof p[c] === 'number' && Number.isFinite(p[c]) && p[c] >= 0), `${p.slug}.${c} debe ser un número ≥ 0 o null`);
    for (const c of booleanos) assert.equal(typeof p[c], 'boolean', `${p.slug}.${c} debe ser booleano`);
    for (const c of listas) assert.ok(Array.isArray(p[c]) && p[c].every((x) => typeof x === 'string' && x.trim() !== ''), `${p.slug}.${c} debe ser una lista de textos`);
    assert.ok(p.usos.length > 0, `${p.slug}: al menos un uso`);
    for (const u of p.usos) assert.ok(USOS.includes(u), `${p.slug}: uso desconocido "${u}"`);
    assert.ok(['publico', 'preferencial', 'privado', 'subsidio'].includes(p.categoria), `${p.slug}: categoría`);
    assert.ok(typeof p.ratioCuotaIngreso === 'number' && p.ratioCuotaIngreso > 0 && p.ratioCuotaIngreso <= 1, `${p.slug}.ratioCuotaIngreso entre 0 y 1`);
  }
});

test('integridad: fechaDato es una fecha ISO real y no futura', () => {
  for (const x of [...programas, ...entidades.filter((e) => e.fechaDato !== undefined)]) {
    assert.ok(esFechaValida(x.fechaDato), `${x.slug}: fechaDato inválida "${x.fechaDato}"`);
    assert.ok(x.fechaDato >= '2015-01-01' && x.fechaDato <= HOY, `${x.slug}: fechaDato fuera de rango "${x.fechaDato}"`);
  }
});

test('integridad: ningún registro usa un centinela en lugar de la fecha', () => {
  // Una fecha sin confirmar se omite (entidades) o se deja verificado: false (productos); nunca un texto como "NO CONFIRM".
  const conCentinela = [...programas, ...entidades].filter((x) => x.fechaDato !== undefined && !FECHA_ISO.test(x.fechaDato)).map((x) => x.slug);
  assert.deepEqual(conCentinela, []);
});

test('integridad: fuenteUrl y demás URL son https', () => {
  const esHttps = (u) => {
    try { return new URL(u).protocol === 'https:'; } catch { return false; }
  };
  for (const p of programas) assert.ok(esHttps(p.fuenteUrl), `${p.slug}: fuenteUrl "${p.fuenteUrl}"`);
  for (const e of entidades) {
    for (const c of ['sitioUrl', 'simuladorUrl', 'fuenteUrl']) {
      if (e[c] !== undefined) assert.ok(esHttps(e[c]), `${e.slug}.${c}: "${e[c]}"`);
    }
  }
});

test('integridad: coherencia interna de cada producto', () => {
  for (const p of programas) {
    const id = p.slug;
    if (p.plazoMinAnios !== null && p.plazoMaxAnios !== null) assert.ok(p.plazoMinAnios <= p.plazoMaxAnios, `${id}: plazo mínimo ≤ máximo`);
    if (p.montoMinUsd !== null && p.montoMaxUsd !== null) assert.ok(p.montoMinUsd <= p.montoMaxUsd, `${id}: monto mínimo ≤ máximo`);
    if (p.edadMin !== null && p.edadMax !== null) assert.ok(p.edadMin < p.edadMax, `${id}: edad mínima < máxima`);
    if (p.precioViviendaMinUsd !== undefined && p.precioViviendaMaxUsd !== null) assert.ok(p.precioViviendaMinUsd < p.precioViviendaMaxUsd, `${id}: precio mínimo < máximo`);
    for (const c of ['financiamientoMaxPct', 'entradaMinPct']) {
      if (p[c] !== null) assert.ok(p[c] >= 0 && p[c] <= 100, `${id}.${c} entre 0 y 100`);
    }
    if (p.financiamientoMaxPct !== null && p.entradaMinPct !== null) {
      assert.equal(p.financiamientoMaxPct + p.entradaMinPct, 100, `${id}: financiamiento + entrada = 100`);
    }
    if (p.aportacionesMinimas !== undefined) assert.ok(p.requiereAfiliacionIess, `${id}: aportacionesMinimas solo tiene sentido si requiere IESS`);
    if (p.tramos !== undefined) {
      assert.ok(p.tramos.length > 0, `${id}: tramos no vacío`);
      for (let k = 1; k < p.tramos.length; k++) {
        assert.ok(p.tramos[k].hastaUsd > p.tramos[k - 1].hastaUsd, `${id}: tramos en orden ascendente`);
        assert.ok(p.tramos[k].pct <= p.tramos[k - 1].pct, `${id}: el % no sube con el valor`);
      }
      assert.equal(p.tramos[0].pct, p.financiamientoMaxPct, `${id}: financiamientoMaxPct es el del primer tramo`);
    }
    if (p.categoria === 'subsidio') {
      assert.equal(p.tasaNominal, null, `${id}: un subsidio no tiene tasa`);
    } else {
      assert.ok(p.tasaNominal > 0 && p.tasaNominal < 25, `${id}: tasa nominal verosímil`);
      assert.ok(p.tasaEfectiva >= p.tasaNominal, `${id}: la efectiva no es menor que la nominal`);
      // La efectiva publicada puede incluir otros cargos, pero no debería alejarse de la equivalente.
      assert.ok(Math.abs(p.tasaEfectiva - tasaEfectiva(p.tasaNominal)) < 0.25, `${id}: tasaEfectiva ${p.tasaEfectiva} vs equivalente ${tasaEfectiva(p.tasaNominal).toFixed(2)}`);
      assert.ok(p.plazoMaxAnios !== null && p.financiamientoMaxPct !== null, `${id}: un crédito publica plazo y financiamiento`);
    }
  }
});

test('integridad: campos de cada entidad', () => {
  for (const e of entidades) {
    for (const c of ['slug', 'nombre', 'descripcion']) assert.ok(typeof e[c] === 'string' && e[c].trim() !== '', `${e.slug}.${c}`);
    assert.ok(['publico', 'banco', 'cooperativa', 'mutualista'].includes(e.tipo), `${e.slug}.tipo`);
    const c = e.coberturaProvincias;
    assert.ok(c === 'nacional' || (Array.isArray(c) && c.every((s) => SLUG.test(s))), `${e.slug}.coberturaProvincias`);
    if (Array.isArray(c)) assert.deepEqual(duplicados(c), [], `${e.slug}: provincias repetidas`);
  }
});

// ---------- esquemas ----------

/**
 * Validador mínimo de JSON Schema: solo las palabras clave que usan los esquemas de data/.
 * Devuelve la lista de errores (vacía si el valor es válido).
 */
function validar(esquema, valor, raiz = esquema, ruta = '$') {
  const errores = [];
  const SOPORTADAS = new Set([
    '$schema', '$id', '$defs', '$ref', 'title', 'description', 'type', 'enum', 'const', 'pattern', 'minLength',
    'minimum', 'maximum', 'items', 'minItems', 'uniqueItems', 'properties', 'required', 'additionalProperties', 'oneOf',
  ]);
  for (const k of Object.keys(esquema)) {
    if (!SOPORTADAS.has(k)) throw new Error(`El validador de pruebas no soporta la palabra clave "${k}" (${ruta}).`);
  }
  if (esquema.$ref) {
    assert.ok(esquema.$ref.startsWith('#/'), `$ref local: ${esquema.$ref}`);
    const destino = esquema.$ref.slice(2).split('/').reduce((o, k) => o?.[k], raiz);
    if (!destino) throw new Error(`$ref sin destino: ${esquema.$ref}`);
    errores.push(...validar(destino, valor, raiz, ruta));
  }
  const tipoDe = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
  const coincide = (t) => (t === 'integer' ? Number.isInteger(valor) : tipoDe(valor) === t);
  if (esquema.type !== undefined) {
    const tipos = [].concat(esquema.type);
    if (!tipos.some(coincide)) return [...errores, `${ruta}: se esperaba ${tipos.join(' o ')}, es ${tipoDe(valor)}`];
  }
  if (esquema.const !== undefined && valor !== esquema.const) errores.push(`${ruta}: debe ser ${JSON.stringify(esquema.const)}`);
  if (esquema.enum && !esquema.enum.includes(valor)) errores.push(`${ruta}: "${valor}" no está en ${JSON.stringify(esquema.enum)}`);
  if (typeof valor === 'string') {
    if (esquema.pattern && !new RegExp(esquema.pattern, 'u').test(valor)) errores.push(`${ruta}: "${valor}" no cumple ${esquema.pattern}`);
    if (esquema.minLength !== undefined && [...valor].length < esquema.minLength) errores.push(`${ruta}: texto demasiado corto`);
  }
  if (typeof valor === 'number') {
    if (esquema.minimum !== undefined && valor < esquema.minimum) errores.push(`${ruta}: ${valor} < ${esquema.minimum}`);
    if (esquema.maximum !== undefined && valor > esquema.maximum) errores.push(`${ruta}: ${valor} > ${esquema.maximum}`);
  }
  if (Array.isArray(valor)) {
    if (esquema.minItems !== undefined && valor.length < esquema.minItems) errores.push(`${ruta}: menos de ${esquema.minItems} elementos`);
    if (esquema.uniqueItems && new Set(valor.map((v) => JSON.stringify(v))).size !== valor.length) errores.push(`${ruta}: elementos repetidos`);
    if (esquema.items) valor.forEach((v, i) => errores.push(...validar(esquema.items, v, raiz, `${ruta}[${i}]`)));
  }
  if (tipoDe(valor) === 'object') {
    for (const c of esquema.required ?? []) if (!(c in valor)) errores.push(`${ruta}: falta "${c}"`);
    for (const [c, v] of Object.entries(valor)) {
      const sub = esquema.properties?.[c];
      if (sub) errores.push(...validar(sub, v, raiz, `${ruta}.${c}`));
      else if (esquema.additionalProperties === false) errores.push(`${ruta}: propiedad no permitida "${c}"`);
    }
  }
  if (esquema.oneOf) {
    const validas = esquema.oneOf.filter((s) => validar(s, valor, raiz, ruta).length === 0).length;
    if (validas !== 1) errores.push(`${ruta}: debe cumplir exactamente una alternativa de oneOf (cumple ${validas})`);
  }
  return errores;
}

const esquemaProgramas = leerJson('data/programas.schema.json');
const esquemaEntidades = leerJson('data/entidades.schema.json');

test('esquemas: son JSON Schema 2020-12', () => {
  for (const e of [esquemaProgramas, esquemaEntidades]) {
    assert.equal(e.$schema, 'https://json-schema.org/draft/2020-12/schema');
    assert.equal(e.type, 'array');
  }
});

test('esquemas: programas.json cumple programas.schema.json', () => {
  assert.deepEqual(validar(esquemaProgramas, programas), []);
});

test('esquemas: entidades.json cumple entidades.schema.json', () => {
  assert.deepEqual(validar(esquemaEntidades, entidades), []);
});

test('esquemas: declaran todos los campos que aparecen en los datos y exigen los que nunca faltan', () => {
  const comprobar = (lista, def) => {
    const usados = new Set(lista.flatMap((x) => Object.keys(x)));
    for (const c of usados) assert.ok(c in def.properties, `el esquema no declara "${c}"`);
    const siempre = [...usados].filter((c) => lista.every((x) => c in x));
    for (const c of def.required) assert.ok(siempre.includes(c), `"${c}" es obligatorio en el esquema pero falta en algún registro`);
  };
  comprobar(programas, esquemaProgramas.$defs.programa);
  comprobar(entidades, esquemaEntidades.$defs.entidad);
});

test('esquemas: rechazan registros inválidos', () => {
  const copia = () => structuredClone(programas[0]);
  const errores = (cambio) => {
    const p = copia();
    cambio(p);
    return validar(esquemaProgramas, [p]);
  };
  assert.deepEqual(errores(() => {}), []);
  assert.ok(errores((p) => { delete p.fuenteUrl; }).length > 0, 'falta un campo obligatorio');
  assert.ok(errores((p) => { p.tasaNominal = '2.99'; }).length > 0, 'tasa como texto');
  assert.ok(errores((p) => { p.fechaDato = '01/04/2026'; }).length > 0, 'fecha no ISO');
  assert.ok(errores((p) => { p.fechaDato = '2026-13-01'; }).length > 0, 'mes inexistente');
  assert.ok(errores((p) => { p.fechaDato = 'NO CONFIRM'; }).length > 0, 'centinela en lugar de fecha');
  assert.ok(errores((p) => { p.fuenteUrl = 'http://biess.fin.ec'; }).length > 0, 'URL sin https');
  assert.ok(errores((p) => { p.usos = ['oficina']; }).length > 0, 'uso desconocido');
  assert.ok(errores((p) => { p.categoria = 'otro'; }).length > 0, 'categoría desconocida');
  assert.ok(errores((p) => { p.campoNuevo = 1; }).length > 0, 'propiedad no declarada');
  assert.ok(errores((p) => { p.ratioCuotaIngreso = 35; }).length > 0, 'ratio como porcentaje');
  assert.ok(errores((p) => { p.verificado = 'sí'; }).length > 0, 'booleano como texto');
  assert.ok(errores((p) => { p.tramos = [{ hastaUsd: 1 }]; }).length > 0, 'tramo incompleto');

  const e = (cambio) => {
    const x = structuredClone(entidades[0]);
    cambio(x);
    return validar(esquemaEntidades, [x]);
  };
  assert.deepEqual(e(() => {}), []);
  assert.ok(e((x) => { x.tipo = 'fintech'; }).length > 0, 'tipo desconocido');
  assert.ok(e((x) => { x.coberturaProvincias = 'todo el país'; }).length > 0, 'cobertura inválida');
  assert.ok(e((x) => { x.coberturaProvincias = ['Azuay']; }).length > 0, 'provincia que no es slug');
  assert.ok(e((x) => { delete x.nombre; }).length > 0, 'falta el nombre');
});

// ---------- documentación y paquete ----------

test('documentación: las tablas generadas están al día (npm run tablas)', () => {
  assert.deepEqual(tablasDesactualizadas(), []);
});

test('documentación: data/README.md describe todos los campos', () => {
  const doc = leer('data/README.md');
  const campos = new Set([...programas, ...entidades].flatMap((x) => Object.keys(x)));
  for (const c of campos) assert.ok(doc.includes(`\`${c}\``), `data/README.md no documenta el campo "${c}"`);
});

test('package.json: sin dependencias de runtime y con las entradas esperadas', () => {
  const pkg = leerJson('package.json');
  assert.equal(pkg.name, 'credito-hipotecario-ecuador');
  assert.equal(pkg.type, 'module');
  assert.equal(pkg.license, 'MIT');
  assert.deepEqual(Object.keys(pkg.dependencies ?? {}), []);
  for (const clave of ['.', './evaluacion', './finanzas', './mcp', './data/programas.json', './data/entidades.json']) {
    assert.ok(clave in pkg.exports, `falta exports["${clave}"]`);
  }
  const destinos = Object.values(pkg.exports).flatMap((v) => (typeof v === 'string' ? [v] : Object.values(v)));
  for (const d of destinos) {
    if (d.startsWith('./src/mcp/')) continue; // lo verifican las pruebas del servidor MCP
    assert.ok(existsSync(new URL(`../${d}`, import.meta.url)), `exports apunta a un archivo que no existe: ${d}`);
  }
  assert.ok(existsSync(new URL('../bin/cli.js', import.meta.url)));
  assert.equal(leerJson('package.json').version, leer('CHANGELOG.md').match(/^## \[(\d+\.\d+\.\d+)\]/m)[1], 'la versión coincide con la última del CHANGELOG');
});
