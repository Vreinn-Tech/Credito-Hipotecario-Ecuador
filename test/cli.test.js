import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { programas, entidades, cuotaMensual, evaluarPerfil } from '../src/index.js';

const CLI = fileURLToPath(new URL('../bin/cli.js', import.meta.url));
const ENLACE = 'Más detalle y asesoría gratuita: https://creditohipotecarioecuador.com/evaluacion/';

function cli(...args) {
  const r = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });
  return { codigo: r.status, salida: r.stdout, error: r.stderr };
}
const ok = (...args) => {
  const r = cli(...args);
  assert.equal(r.codigo, 0, `"${args.join(' ')}" terminó con ${r.codigo}: ${r.error}`);
  assert.equal(r.error, '');
  return r.salida;
};

test('cli: --help, -h y sin argumentos muestran la ayuda', () => {
  for (const args of [['--help'], ['-h'], [], ['evaluar', '--help']]) {
    const salida = ok(...args);
    for (const comando of ['evaluar', 'cuota', 'programas', 'programa <slug>', 'entidades']) assert.ok(salida.includes(comando), comando);
    assert.ok(salida.includes('--segunda-vivienda'));
    assert.ok(salida.trimEnd().endsWith(ENLACE));
  }
});

test('cli: --version', () => {
  assert.match(ok('--version').trim(), /^\d+\.\d+\.\d+$/);
});

test('cli: evaluar muestra la tabla, las observaciones y el enlace final', () => {
  const salida = ok('evaluar', '--precio', '65000', '--ingreso', '1200', '--iess', '--aportaciones', '48', '--plazo', '30', '--nueva');
  assert.ok(salida.includes('Perfil evaluado'));
  assert.ok(salida.includes('· nueva'));
  assert.ok(salida.includes('IESS: afiliado, 48 aportaciones'));
  assert.match(salida, /^ ?1 {2}BIESS · CrediCasa 2,99 % .* Apto +100 +2,99 % +30 años +\$65\.000 +\$274 +\$0$/m);
  assert.ok(salida.includes('Observaciones'));
  assert.ok(!salida.includes('No apto'), 'sin --todos no se listan los no aptos');
  assert.ok(salida.trimEnd().endsWith(ENLACE));
});

test('cli: sin --nueva, CrediCasa queda condicional y pide confirmar que la vivienda es nueva', () => {
  const salida = ok('evaluar', '--precio', '65000', '--ingreso', '1200', '--iess', '--aportaciones', '48', '--plazo', '30');
  assert.match(salida, /^ ?1 {2}BIESS · CrediCasa 2,99 % .* Condicional +\d+ +2,99 % +30 años +\$65\.000 +\$274 +\$0$/m);
  assert.ok(salida.includes('confirma que la vivienda lo es'));
});

test('cli: evaluar --json con precio sobre el monto máximo de CrediCasa exige la diferencia como entrada', () => {
  const datos = JSON.parse(ok('evaluar', '--precio', '70000', '--ingreso', '1200', '--iess', '--aportaciones', '48', '--nueva', '--json'));
  const cc = datos.resultados.find((r) => r.slug === 'biess-credicasa');
  assert.equal(cc.elegibilidad, 'condicional');
  assert.equal(cc.entradaRequerida, 5000);
  assert.equal(cc.montoFinanciable, 65000);
  assert.deepEqual(cc.razones, ['El monto máximo del producto es 65.000 USD: necesitas una entrada de al menos 5.000 USD.']);
  const conEntrada = JSON.parse(ok('evaluar', '--precio', '70000', '--entrada', '5000', '--ingreso', '1200', '--iess', '--aportaciones', '48', '--nueva', '--json'));
  assert.equal(conEntrada.resultados.find((r) => r.slug === 'biess-credicasa').elegibilidad, 'apto');
});

test('cli: evaluar --todos incluye los no aptos con su motivo', () => {
  const salida = ok('evaluar', '--precio', '70000', '--ingreso', '1200', '--todos');
  assert.ok(salida.includes('No apto'));
  assert.ok(salida.includes('Requiere afiliación al IESS.'));
});

test('cli: evaluar --json coincide con la librería', () => {
  const datos = JSON.parse(ok('evaluar', '--precio', '120000', '--entrada', '30000', '--ingreso', '2500', '--deudas', '200',
    '--edad', '45', '--plazo', '15', '--relacion', 'independiente', '--usada', '--segunda-vivienda', '--uso', 'vivienda_terminada', '--todos', '--json'));
  const esperado = evaluarPerfil({
    precioVivienda: 120000, entradaDisponible: 30000, ingresoMensual: 2500, deudasMensuales: 200, edad: 45,
    plazoDeseado: 15, relacionLaboral: 'independiente', viviendaNueva: false, primeraVivienda: false,
  });
  assert.equal(datos.perfil.viviendaNueva, false);
  assert.equal(datos.perfil.primeraVivienda, false);
  assert.equal(datos.perfil.afiliadoIess, false);
  assert.equal(datos.resultados.length, esperado.length);
  assert.deepEqual(
    datos.resultados.map((r) => [r.slug, r.elegibilidad, r.score, r.plazo, r.cuotaEstimada, r.razones]),
    esperado.map((r) => [r.programa.slug, r.elegibilidad, r.score, r.plazo, r.cuotaEstimada, r.razones]),
  );
  assert.equal(datos.resumen.evaluados, esperado.length);
  assert.equal(datos.resumen.aptos + datos.resumen.condicionales + datos.resumen.noAptos, esperado.length);
  assert.equal(datos.masInformacion, 'https://creditohipotecarioecuador.com/evaluacion/');
  assert.equal(datos.resultados[0].url, `https://creditohipotecarioecuador.com/programas/${datos.resultados[0].slug}/`);
});

test('cli: evaluar --json sin --todos omite los no aptos; --nueva se refleja en el perfil', () => {
  const datos = JSON.parse(ok('evaluar', '--precio', '70000', '--ingreso', '1200', '--nueva', '--json'));
  assert.equal(datos.perfil.viviendaNueva, true);
  assert.ok(datos.resultados.every((r) => r.elegibilidad !== 'no_apto'));
  assert.equal(datos.resultados.length, datos.resumen.aptos + datos.resumen.condicionales);
});

test('cli: cuota', () => {
  const salida = ok('cuota', '--monto', '65000', '--tasa', '2.99', '--plazo', '30');
  assert.ok(salida.includes('$273,69'));
  assert.ok(salida.includes('3,03 %'));
  assert.ok(salida.includes('360 cuotas'));
  assert.ok(salida.trimEnd().endsWith(ENLACE));
  assert.ok(ok('cuota', '--monto', '65000', '--tasa', '2,99', '--plazo', '30').includes('$273,69'), 'acepta coma decimal');
});

test('cli: cuota --tabla y --json', () => {
  const texto = ok('cuota', '--monto', '1000', '--tasa', '12', '--plazo', '1', '--tabla');
  assert.equal(texto.split('\n').filter((l) => /^ *\d+ {2}\$/.test(l)).length, 12);
  const datos = JSON.parse(ok('cuota', '--monto', '65000', '--tasa', '2.99', '--plazo', '30', '--tabla', '--json'));
  assert.equal(datos.cuotaMensual, cuotaMensual({ monto: 65000, tasaNominalAnual: 2.99, plazoAnios: 30 }));
  assert.equal(datos.tabla.length, 360);
  assert.ok(!('tabla' in JSON.parse(ok('cuota', '--monto', '1000', '--tasa', '12', '--plazo', '1', '--json'))));
});

test('cli: programas lista todo y filtra por categoría y entidad', () => {
  const todos = ok('programas');
  for (const p of programas) assert.ok(todos.includes(p.slug), p.slug);
  assert.ok(todos.includes(`${programas.length} producto(s)`));
  assert.ok(todos.trimEnd().endsWith(ENLACE));
  const publicos = JSON.parse(ok('programas', '--categoria', 'publico', '--json'));
  assert.deepEqual(publicos, programas.filter((p) => p.categoria === 'publico'));
  const biess = JSON.parse(ok('programas', '--entidad', 'biess', '--json'));
  assert.ok(biess.length > 0 && biess.every((p) => p.entidad === 'biess'));
  assert.ok(ok('programas', '--categoria', 'subsidio').includes('2 producto(s)'));
  assert.ok(ok('programas', '--entidad', 'banco-guayaquil').includes('Ningún producto'));
});

test('cli: programa <slug>', () => {
  const salida = ok('programa', 'biess-credicasa');
  assert.ok(salida.startsWith('BIESS · CrediCasa 2,99 %'));
  for (const titulo of ['Requisitos', 'Ventajas', 'Desventajas', 'Pasos', 'Fecha del dato']) assert.ok(salida.includes(titulo), titulo);
  assert.ok(salida.includes('https://creditohipotecarioecuador.com/programas/biess-credicasa/'));
  assert.ok(salida.trimEnd().endsWith(ENLACE));
  assert.deepEqual(JSON.parse(ok('programa', 'biess-credicasa', '--json')), programas.find((p) => p.slug === 'biess-credicasa'));
  for (const p of programas) ok('programa', p.slug); // ninguna ficha rompe el formato
});

test('cli: entidades', () => {
  const salida = ok('entidades');
  for (const e of entidades) assert.ok(salida.includes(e.slug), e.slug);
  assert.ok(salida.includes(`${entidades.length} entidad(es)`));
  assert.ok(salida.trimEnd().endsWith(ENLACE));
  const mutualistas = JSON.parse(ok('entidades', '--tipo', 'mutualista', '--json'));
  assert.deepEqual(mutualistas, entidades.filter((e) => e.tipo === 'mutualista'));
});

test('cli: errores de uso terminan con código 2 y mensaje en español', () => {
  const casos = [
    [['evaluar', '--ingreso', '1200'], /Falta la opción --precio/],
    [['evaluar', '--precio', '70000'], /Falta la opción --ingreso/],
    [['evaluar', '--precio', '70.000', '--ingreso', '1200'], /sin separador de miles/],
    [['evaluar', '--precio', 'abc', '--ingreso', '1200'], /--precio debe ser un número/],
    [['evaluar', '--precio', '70000', '--ingreso', '1200', '--nueva', '--usada'], /no ambas/],
    [['evaluar', '--precio', '70000', '--ingreso', '1200', '--inventada'], /Opción desconocida: --inventada/],
    [['cuota', '--monto', '65000', '--tasa', '2.99'], /Falta la opción --plazo/],
    [['cuota', '--monto', '0', '--tasa', '2.99', '--plazo', '30'], /--monto debe ser mayor que 0/],
    [['programas', '--categoria', 'otra'], /--categoria debe ser uno de/],
    [['programas', '--entidad', 'no-existe'], /No existe la entidad/],
    [['programa'], /Indica el slug/],
    [['programa', 'no-existe'], /No existe el producto "no-existe"/],
    [['programa', 'biess'], /¿Quisiste decir: biess-credicasa/],
    [['entidades', '--tipo', 'fintech'], /--tipo debe ser uno de/],
    [['desconocido'], /Comando desconocido/],
  ];
  for (const [args, patron] of casos) {
    const r = cli(...args);
    assert.equal(r.codigo, 2, args.join(' '));
    assert.equal(r.salida, '');
    assert.match(r.error, patron);
    assert.ok(r.error.includes('--help'));
  }
});

test('cli: un perfil inválido termina con código 1 y el mensaje del validador', () => {
  for (const [args, patron] of [
    [['evaluar', '--precio', '70000', '--ingreso', '1200', '--edad', '12'], /"edad" debe ser un número entre 18 y 100/],
    [['evaluar', '--precio', '70000', '--ingreso', '1200', '--uso', 'oficina'], /"uso" debe ser uno de/],
    [['evaluar', '--precio', '70000', '--ingreso', '1200', '--relacion', 'estudiante'], /"relacionLaboral" debe ser uno de/],
    [['evaluar', '--precio', '70000', '--ingreso', '1200', '--plazo', '60'], /"plazoDeseado"/],
  ]) {
    const r = cli(...args);
    assert.equal(r.codigo, 1, args.join(' '));
    assert.match(r.error, patron);
  }
});
