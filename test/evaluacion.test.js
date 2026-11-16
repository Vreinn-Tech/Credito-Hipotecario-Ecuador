import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluarPrograma, evaluarTodos, normalizarPerfil, USOS, RELACIONES_LABORALES } from '../src/evaluacion.js';
import { cuotaMensual } from '../src/finanzas.js';
import { programas, buscarPrograma, evaluarPerfil } from '../src/index.js';

const perfil = (extra = {}) => normalizarPerfil({ precioVivienda: 65000, ingresoMensual: 1200, ...extra });
const afiliado = (extra = {}) => perfil({ afiliadoIess: true, aportaciones: 48, ...extra });
const prog = (slug) => {
  const p = buscarPrograma(slug);
  assert.ok(p, `existe el producto ${slug}`);
  return p;
};
const incluye = (r, fragmento) =>
  assert.ok(r.razones.some((x) => x.includes(fragmento)), `alguna razón contiene "${fragmento}": ${JSON.stringify(r.razones)}`);

/** Producto mínimo sin restricciones, para probar una regla cada vez. */
const base = (extra = {}) => ({
  slug: 'prueba', nombre: 'Producto de prueba', entidad: 'prueba', categoria: 'privado',
  resumen: '', descripcion: '', paraQuien: '', usos: ['vivienda_terminada'],
  tasaNominal: 4, tasaEfectiva: 4.07, plazoMinAnios: 3, plazoMaxAnios: 20,
  financiamientoMaxPct: 80, entradaMinPct: 20, montoMinUsd: null, montoMaxUsd: null,
  precioViviendaMaxUsd: null, requiereAfiliacionIess: false, edadMin: 18, edadMax: 75,
  ratioCuotaIngreso: 0.35, soloPrimeraVivienda: false, requisitos: [], ventajas: [], desventajas: [],
  fuenteUrl: 'https://example.com', fechaDato: '2026-01-01', verificado: true, ...extra,
});
/** Perfil holgado: califica sin observaciones al producto base. */
const holgado = (extra = {}) => normalizarPerfil({ precioVivienda: 100000, entradaDisponible: 20000, ingresoMensual: 5000, ...extra });

// ---------- CrediCasa (BIESS) ----------

test('afiliado con 48 aportaciones y vivienda nueva califica a CrediCasa sin observaciones', () => {
  const r = evaluarPrograma(prog('biess-credicasa'), afiliado({ plazoDeseado: 30, viviendaNueva: true }));
  assert.equal(r.elegibilidad, 'apto');
  assert.deepEqual(r.razones, []);
  assert.equal(r.montoFinanciable, 65000);
  assert.equal(r.entradaRequerida, 0);
  assert.equal(r.plazo, 30);
  assert.equal(Math.round(r.cuotaEstimada), 274);
  assert.equal(r.score, 100); // cuota holgada, tasa < 4,5 %, sin razones, dato verificado
  assert.equal(r.programa.slug, 'biess-credicasa');
});

test('CrediCasa es la mejor opción para ese afiliado', () => {
  const [mejor] = evaluarPerfil({ precioVivienda: 65000, ingresoMensual: 1200, afiliadoIess: true, aportaciones: 48, plazoDeseado: 30, viviendaNueva: true });
  assert.equal(mejor.programa.slug, 'biess-credicasa');
  assert.equal(mejor.elegibilidad, 'apto');
});

test('no afiliado: CrediCasa y todo el BIESS quedan bloqueados', () => {
  const r = evaluarPrograma(prog('biess-credicasa'), perfil());
  assert.equal(r.elegibilidad, 'no_apto');
  assert.equal(r.score, 0);
  incluye(r, 'Requiere afiliación al IESS.');
  for (const res of evaluarTodos(programas, perfil())) {
    if (res.programa.requiereAfiliacionIess) assert.equal(res.elegibilidad, 'no_apto', res.programa.slug);
  }
});

test('afiliado con pocas aportaciones: bloqueo con el detalle', () => {
  const r = evaluarPrograma(prog('biess-credicasa'), afiliado({ aportaciones: 20 }));
  assert.equal(r.elegibilidad, 'no_apto');
  incluye(r, 'Requiere al menos 36 aportaciones al IESS (tienes 20).');
  assert.ok(!r.razones.includes('Requiere afiliación al IESS.'));
});

test('precio sobre el tope del programa: bloqueo', () => {
  const tope = prog('biess-credicasa').precioViviendaMaxUsd;
  assert.equal(evaluarPrograma(prog('biess-credicasa'), afiliado({ precioVivienda: tope })).elegibilidad !== 'no_apto', true);
  const r = evaluarPrograma(prog('biess-credicasa'), afiliado({ precioVivienda: tope + 1 }));
  assert.equal(r.elegibilidad, 'no_apto');
  incluye(r, 'supera el tope del programa');
});

test('precio bajo el tope pero sobre el monto máximo: la entrada requerida cubre la diferencia', () => {
  const p = prog('biess-credicasa'); // financia 100 % con montoMaxUsd 65.000
  const sinEntrada = evaluarPrograma(p, afiliado({ precioVivienda: 70000, plazoDeseado: 30, viviendaNueva: true }));
  assert.equal(sinEntrada.elegibilidad, 'condicional');
  assert.equal(sinEntrada.entradaRequerida, 5000);
  assert.equal(sinEntrada.montoFinanciable, 65000);
  assert.deepEqual(sinEntrada.razones, ['El monto máximo del producto es 65.000 USD: necesitas una entrada de al menos 5.000 USD.']);
  const conEntrada = evaluarPrograma(p, afiliado({ precioVivienda: 70000, entradaDisponible: 5000, plazoDeseado: 30, viviendaNueva: true }));
  assert.equal(conEntrada.elegibilidad, 'apto');
  assert.deepEqual(conEntrada.razones, []);
  assert.equal(conEntrada.entradaRequerida, 5000);
  assert.equal(conEntrada.montoFinanciable, 65000);
  // Con algo de entrada pero menos de la necesaria sigue condicional.
  const corta = evaluarPrograma(p, afiliado({ precioVivienda: 70000, entradaDisponible: 4999, plazoDeseado: 30, viviendaNueva: true }));
  assert.equal(corta.elegibilidad, 'condicional');
  assert.equal(corta.montoFinanciable, 65000);
});

test('ingreso sobre el tope del programa: bloqueo', () => {
  const r = evaluarPrograma(prog('biess-credicasa'), afiliado({ ingresoMensual: 2000 }));
  assert.equal(r.elegibilidad, 'no_apto');
  incluye(r, 'Tus ingresos familiares superan el tope');
});

test('segunda vivienda bloquea CrediCasa', () => {
  incluye(evaluarPrograma(prog('biess-credicasa'), afiliado({ primeraVivienda: false, viviendaNueva: true })), 'Solo aplica para primera vivienda.');
});

test('solo vivienda nueva: usada bloquea, nueva es apto y sin dato queda condicional', () => {
  const p = prog('biess-credicasa');
  const usada = evaluarPrograma(p, afiliado({ viviendaNueva: false }));
  assert.equal(usada.elegibilidad, 'no_apto');
  assert.deepEqual(usada.razones, ['Solo financia vivienda nueva de primer uso.']);
  const nueva = evaluarPrograma(p, afiliado({ viviendaNueva: true }));
  assert.equal(nueva.elegibilidad, 'apto');
  assert.deepEqual(nueva.razones, []);
  const desconocida = evaluarPrograma(p, afiliado());
  assert.ok(!('viviendaNueva' in afiliado()));
  assert.equal(desconocida.elegibilidad, 'condicional');
  assert.deepEqual(desconocida.razones, ['Solo financia vivienda nueva de primer uso: confirma que la vivienda lo es.']);
  // Un producto que no exige vivienda nueva no pregunta.
  assert.equal(evaluarPrograma(base(), holgado()).elegibilidad, 'apto');
  assert.equal(evaluarPrograma(base({ soloViviendaNueva: false }), holgado({ viviendaNueva: false })).elegibilidad, 'apto');
});

// ---------- Tramos del BIESS ----------

test('BIESS vivienda terminada: el % financiable baja por tramos según el precio', () => {
  const p = prog('biess-vivienda-terminada');
  assert.deepEqual(p.tramos.map((t) => t.pct), [95, 90, 85, 80]);
  const casos = [[90000, 95], [94303, 95], [94304, 90], [136213, 90], [200000, 85], [400000, 80]];
  for (const [precio, pct] of casos) {
    const r = evaluarPrograma(p, afiliado({ precioVivienda: precio, ingresoMensual: 20000, plazoDeseado: 25 }));
    assert.ok(Math.abs(r.entradaRequerida - precio * (1 - pct / 100)) < 1e-6, `precio ${precio}: entrada del ${100 - pct} %`);
    assert.ok(Math.abs(r.montoFinanciable - precio * pct / 100) < 1e-6, `precio ${precio}: financia el ${pct} %`);
    incluye(r, `Necesitas una entrada mínima del ${100 - pct} %`);
    assert.equal(r.elegibilidad, 'condicional');
  }
});

test('BIESS vivienda terminada: con la entrada del tramo cubierta es apto', () => {
  const r = evaluarPrograma(prog('biess-vivienda-terminada'), afiliado({ precioVivienda: 120000, entradaDisponible: 12000, ingresoMensual: 4000, plazoDeseado: 25 }));
  assert.equal(r.elegibilidad, 'apto');
  assert.equal(r.montoFinanciable, 108000);
  assert.equal(r.entradaRequerida, 12000);
});

test('los tramos tienen prioridad sobre financiamientoMaxPct', () => {
  const p = base({ financiamientoMaxPct: 50, tramos: [{ hastaUsd: 100000, pct: 90 }, { hastaUsd: 200000, pct: 70 }] });
  assert.equal(evaluarPrograma(p, holgado({ precioVivienda: 100000 })).entradaRequerida, 10000);
  assert.ok(Math.abs(evaluarPrograma(p, holgado({ precioVivienda: 150000 })).entradaRequerida - 45000) < 1e-6);
  // Sobre el último tramo se usa financiamientoMaxPct.
  assert.equal(evaluarPrograma(p, holgado({ precioVivienda: 300000 })).entradaRequerida, 150000);
});

// ---------- Plazo ----------

test('plazo bajo el mínimo del producto: se usa el mínimo y queda condicional', () => {
  const p = base({ plazoMinAnios: 5 });
  const r = evaluarPrograma(p, holgado({ plazoDeseado: 1 }));
  assert.equal(r.plazo, 5);
  assert.equal(r.elegibilidad, 'condicional');
  assert.deepEqual(r.razones, ['El plazo mínimo del producto es de 5 años; la cuota se calcula a 5 años.']);
  assert.equal(r.cuotaEstimada, cuotaMensual({ monto: 80000, tasaNominalAnual: 4, plazoAnios: 5 }));
  // En el mínimo exacto no hay observación.
  const justo = evaluarPrograma(p, holgado({ plazoDeseado: 5 }));
  assert.equal(justo.plazo, 5);
  assert.equal(justo.elegibilidad, 'apto');
  // Un producto real: CrediCasa (mínimo 5 años) con plazo deseado de 1 año.
  const cc = evaluarPrograma(prog('biess-credicasa'), afiliado({ plazoDeseado: 1, viviendaNueva: true }));
  assert.equal(cc.plazo, 5);
  incluye(cc, 'El plazo mínimo del producto es de 5 años; la cuota se calcula a 5 años.');
});

test('plazo: primero el tope máximo, luego el mínimo y al final la edad', () => {
  // Tope máximo: 30 años pedidos en un producto de 20 → 20, sin observación.
  assert.equal(evaluarPrograma(base(), holgado({ plazoDeseado: 30 })).plazo, 20);
  // Mínimo y luego edad: la edad no recorta si deja al menos el mínimo (75 − 68 = 7 ≥ 5).
  const minYEdad = evaluarPrograma(base({ plazoMinAnios: 5 }), holgado({ plazoDeseado: 2, edad: 68 }));
  assert.equal(minYEdad.plazo, 5);
  assert.deepEqual(minYEdad.razones, ['El plazo mínimo del producto es de 5 años; la cuota se calcula a 5 años.']);
  // Si la edad no permite ni el mínimo, bloquea.
  const bloqueo = evaluarPrograma(base({ plazoMinAnios: 5 }), holgado({ plazoDeseado: 2, edad: 72 }));
  assert.equal(bloqueo.elegibilidad, 'no_apto');
  incluye(bloqueo, 'Por edad, el plazo disponible sería menor al mínimo');
  // La edad puede recortar por debajo del deseado sin bajar del mínimo.
  const edad = evaluarPrograma(base({ plazoMinAnios: 5 }), holgado({ plazoDeseado: 20, edad: 69 }));
  assert.equal(edad.plazo, 6);
  assert.deepEqual(edad.razones, ['Por tu edad el plazo máximo sería de 6 años.']);
  // Sin plazo mínimo publicado no se fuerza ninguno.
  assert.equal(evaluarPrograma(base({ plazoMinAnios: null }), holgado({ plazoDeseado: 1 })).plazo, 1);
});

// ---------- Edad ----------

test('edad: el plazo se recorta para no pasar de la edad máxima (condicional)', () => {
  const p = prog('biess-vivienda-terminada'); // edadMax 75, plazo mínimo 5
  const r = evaluarPrograma(p, afiliado({ edad: 60, plazoDeseado: 25, precioVivienda: 60000, entradaDisponible: 10000, ingresoMensual: 3000 }));
  assert.equal(r.plazo, 15);
  assert.equal(r.elegibilidad, 'condicional');
  assert.deepEqual(r.razones, ['Por tu edad el plazo máximo sería de 15 años.']);
});

test('edad: si no alcanza el plazo mínimo, bloqueo', () => {
  const p = prog('biess-vivienda-terminada');
  const r = evaluarPrograma(p, afiliado({ edad: 72, precioVivienda: 60000, entradaDisponible: 10000, ingresoMensual: 3000 }));
  assert.equal(r.elegibilidad, 'no_apto');
  incluye(r, 'Por edad, el plazo disponible sería menor al mínimo (edad máxima al terminar: 75).');
  // Justo en el límite (75 − 70 = 5 años = plazo mínimo) no bloquea por edad.
  const limite = evaluarPrograma(p, afiliado({ edad: 70, precioVivienda: 60000, entradaDisponible: 10000, ingresoMensual: 6000 }));
  assert.equal(limite.plazo, 5);
  assert.notEqual(limite.elegibilidad, 'no_apto');
});

test('edad mínima: bloqueo por debajo, sin bloqueo en el límite', () => {
  const p = base({ edadMin: 25 });
  const joven = evaluarPrograma(p, holgado({ edad: 24 }));
  assert.equal(joven.elegibilidad, 'no_apto');
  assert.deepEqual(joven.razones, ['Edad mínima: 25 años.']);
  assert.equal(evaluarPrograma(p, holgado({ edad: 25 })).elegibilidad, 'apto');
});

test('sin edadMax no se recorta el plazo', () => {
  const r = evaluarPrograma(base({ edadMax: null }), holgado({ edad: 90, plazoDeseado: 20 }));
  assert.equal(r.plazo, 20);
  assert.equal(r.elegibilidad, 'apto');
});

// ---------- Destino ----------

test('destino no financiado: bloqueo; vivienda_terminada acepta productos VIS/VIP', () => {
  const soloVis = base({ usos: ['vis_vip'] });
  assert.equal(evaluarPrograma(soloVis, holgado({ uso: 'vivienda_terminada' })).elegibilidad, 'apto');
  const r = evaluarPrograma(base(), holgado({ uso: 'terreno' }));
  assert.equal(r.elegibilidad, 'no_apto');
  assert.deepEqual(r.razones, ['Este producto no financia el destino que buscas.']);
  // La excepción no es simétrica: buscar vis_vip no acepta un producto solo de vivienda terminada.
  assert.equal(evaluarPrograma(base(), holgado({ uso: 'vis_vip' })).elegibilidad, 'no_apto');
});

test('destino terreno: solo califican productos que lo financian', () => {
  const res = evaluarTodos(programas, afiliado({ uso: 'terreno', precioVivienda: 30000, entradaDisponible: 10000, ingresoMensual: 3000, plazoDeseado: 10 }));
  for (const r of res) {
    if (!r.programa.usos.includes('terreno')) assert.equal(r.elegibilidad, 'no_apto', r.programa.slug);
  }
  assert.ok(res.some((r) => r.programa.slug === 'biess-terreno' && r.elegibilidad !== 'no_apto'));
});

// ---------- Entrada, montos y cuota ----------

test('producto sin restricciones y perfil holgado: apto', () => {
  const r = evaluarPrograma(base(), holgado());
  assert.equal(r.elegibilidad, 'apto');
  assert.deepEqual(r.razones, []);
  assert.equal(r.montoFinanciable, 80000);
  assert.equal(r.entradaRequerida, 20000);
  assert.equal(r.plazo, 20);
  assert.equal(r.cuotaEstimada, cuotaMensual({ monto: 80000, tasaNominalAnual: 4, plazoAnios: 20 }));
  assert.equal(r.score, 100);
});

test('entrada insuficiente: condicional y el monto se limita al % financiable', () => {
  const r = evaluarPrograma(base(), holgado({ entradaDisponible: 5000 }));
  assert.equal(r.elegibilidad, 'condicional');
  assert.equal(r.montoFinanciable, 80000);
  assert.deepEqual(r.razones, ['Necesitas una entrada mínima del 20 % (≈ 20.000 USD).']);
});

test('con más entrada de la exigida se financia solo lo que falta', () => {
  const r = evaluarPrograma(base(), holgado({ entradaDisponible: 60000 }));
  assert.equal(r.montoFinanciable, 40000);
  assert.equal(r.entradaRequerida, 20000);
  assert.equal(r.elegibilidad, 'apto');
});

test('monto máximo y monto mínimo del producto: condicional', () => {
  const tope = evaluarPrograma(base({ montoMaxUsd: 50000 }), holgado());
  assert.equal(tope.elegibilidad, 'condicional');
  assert.equal(tope.montoFinanciable, 50000);
  assert.equal(tope.entradaRequerida, 50000);
  assert.deepEqual(tope.razones, ['El monto máximo del producto es 50.000 USD: necesitas una entrada de al menos 50.000 USD.']);
  const conEntrada = evaluarPrograma(base({ montoMaxUsd: 50000 }), holgado({ entradaDisponible: 50000 }));
  assert.equal(conEntrada.elegibilidad, 'apto');
  assert.equal(conEntrada.montoFinanciable, 50000);
  // Si el % financiable es más restrictivo que el monto máximo, manda el mensaje del porcentaje.
  const pct = evaluarPrograma(base({ montoMaxUsd: 90000 }), holgado({ entradaDisponible: 0 }));
  assert.equal(pct.entradaRequerida, 20000);
  assert.deepEqual(pct.razones, ['Necesitas una entrada mínima del 20 % (≈ 20.000 USD).']);
  const minimo = evaluarPrograma(base({ montoMinUsd: 10000 }), holgado({ precioVivienda: 50000, entradaDisponible: 45000 }));
  assert.equal(minimo.elegibilidad, 'condicional');
  assert.equal(minimo.montoFinanciable, 5000);
  incluye(minimo, 'El monto mínimo del producto es 10.000 USD.');
});

test('cuota sobre el límite: condicional hasta un 40 % de exceso, bloqueo por encima', () => {
  const p = base();
  const cuota = cuotaMensual({ monto: 80000, tasaNominalAnual: 4, plazoAnios: 20 });
  const ingresoPara = (exceso) => cuota / (0.35 * exceso); // ratio = exceso × límite
  const justo = evaluarPrograma(p, holgado({ ingresoMensual: ingresoPara(0.99) }));
  assert.equal(justo.elegibilidad, 'apto');
  const ajustado = evaluarPrograma(p, holgado({ ingresoMensual: ingresoPara(1.2) }));
  assert.equal(ajustado.elegibilidad, 'condicional');
  incluye(ajustado, 'superaría el 35 % de tu ingreso disponible. Podrías aumentar la entrada o el plazo.');
  const excedido = evaluarPrograma(p, holgado({ ingresoMensual: ingresoPara(1.5) }));
  assert.equal(excedido.elegibilidad, 'no_apto');
  incluye(excedido, 'superaría el 35 % de tu ingreso disponible.');
  assert.equal(excedido.score, 0);
});

test('las deudas reducen el ingreso disponible y la capacidad', () => {
  const sin = evaluarPrograma(base(), holgado({ ingresoMensual: 2000 }));
  const con = evaluarPrograma(base(), holgado({ ingresoMensual: 2000, deudasMensuales: 1000 }));
  assert.ok(Math.abs(con.capacidadMaxima - sin.capacidadMaxima / 2) < 1e-6);
  assert.equal(sin.elegibilidad, 'apto');
  assert.notEqual(con.elegibilidad, 'apto');
});

test('ingreso disponible 0: bloqueo y capacidad 0', () => {
  const r = evaluarPrograma(base(), holgado({ ingresoMensual: 800, deudasMensuales: 900 }));
  assert.equal(r.elegibilidad, 'no_apto');
  assert.equal(r.capacidadMaxima, 0);
});

test('valores por defecto del motor cuando la ficha no publica el dato', () => {
  const r = evaluarPrograma(base({ tasaNominal: null, plazoMaxAnios: null, financiamientoMaxPct: null }), holgado({ plazoDeseado: 30 }));
  assert.equal(r.plazo, 25);
  assert.equal(r.montoFinanciable, 80000); // 80 % por defecto
  assert.equal(r.cuotaEstimada, cuotaMensual({ monto: 80000, tasaNominalAnual: 10, plazoAnios: 25 }));
});

// ---------- Relación laboral ----------

test('independiente: condicional en cualquier producto', () => {
  const r = evaluarPrograma(base(), holgado({ relacionLaboral: 'independiente' }));
  assert.equal(r.elegibilidad, 'condicional');
  incluye(r, 'Como independiente deberás justificar ingresos');
});

test('migrante: condicional solo en productos públicos', () => {
  assert.equal(evaluarPrograma(base(), holgado({ relacionLaboral: 'migrante' })).elegibilidad, 'apto');
  const r = evaluarPrograma(base({ categoria: 'publico' }), holgado({ relacionLaboral: 'migrante' }));
  assert.equal(r.elegibilidad, 'condicional');
  incluye(r, 'ecuatorianos en el exterior');
});

test('un bloqueo prevalece sobre las condiciones y conserva todas las razones', () => {
  const r = evaluarPrograma(base({ edadMin: 25 }), holgado({ edad: 20, entradaDisponible: 0, relacionLaboral: 'independiente' }));
  assert.equal(r.elegibilidad, 'no_apto');
  assert.equal(r.razones.length, 3);
});

// ---------- Puntaje ----------

test('puntaje: fórmula completa', () => {
  const esperado = (p, u, r) => {
    const ratio = r.cuotaEstimada / (u.ingresoMensual - u.deudasMensuales);
    let s = 100;
    s -= Math.min(40, Math.max(0, (ratio / p.ratioCuotaIngreso - 0.6) * 60));
    s -= Math.min(30, Math.max(0, (p.tasaNominal - 4.5) * 4));
    s -= Math.min(20, r.razones.length * 6);
    if (!p.verificado) s -= 2;
    return Math.round(Math.max(0, s));
  };
  const casos = [
    [base(), holgado()],
    [base({ tasaNominal: 9.5 }), holgado()],
    [base({ tasaNominal: 9.5, verificado: false }), holgado({ ingresoMensual: 2400, relacionLaboral: 'independiente' })],
    [base({ tasaNominal: 14 }), holgado({ entradaDisponible: 0, ingresoMensual: 3200 })],
  ];
  for (const [p, u] of casos) {
    const r = evaluarPrograma(p, u);
    assert.notEqual(r.elegibilidad, 'no_apto');
    assert.equal(r.score, esperado(p, u, r));
  }
});

test('puntaje: cada componente resta lo que dice la fórmula', () => {
  const u = holgado();
  assert.equal(evaluarPrograma(base({ tasaNominal: 4.5 }), u).score, 100);
  assert.equal(evaluarPrograma(base({ tasaNominal: 7 }), u).score, 90); // (7 − 4,5) × 4 = 10
  assert.equal(evaluarPrograma(base({ tasaNominal: 7, verificado: false }), u).score, 88);
  assert.equal(evaluarPrograma(base({ tasaNominal: 7 }), holgado({ relacionLaboral: 'independiente' })).score, 84); // 1 razón = 6
  // El costo de la tasa resta como máximo 30 (ingreso alto para que la cuota no reste).
  assert.equal(evaluarPrograma(base({ tasaNominal: 20 }), holgado({ ingresoMensual: 50000 })).score, 70);
});

test('puntaje: 0 para no aptos y siempre entre 0 y 100', () => {
  for (const u of [perfil(), afiliado(), afiliado({ precioVivienda: 250000, entradaDisponible: 50000, ingresoMensual: 6000 }), perfil({ ingresoMensual: 300 })]) {
    for (const r of evaluarTodos(programas, u)) {
      assert.ok(Number.isInteger(r.score) && r.score >= 0 && r.score <= 100, `${r.programa.slug}: ${r.score}`);
      if (r.elegibilidad === 'no_apto') {
        assert.equal(r.score, 0);
        assert.ok(r.razones.length > 0, 'un no apto siempre explica por qué');
      }
      if (r.elegibilidad === 'apto') assert.deepEqual(r.razones, []);
      if (r.elegibilidad === 'condicional') assert.ok(r.razones.length > 0);
    }
  }
});

// ---------- evaluarTodos ----------

test('evaluarTodos: excluye subsidios y ordena por puntaje y luego por cuota', () => {
  const res = evaluarTodos(programas, afiliado({ precioVivienda: 90000, entradaDisponible: 20000, ingresoMensual: 2500 }));
  const creditos = programas.filter((p) => p.categoria !== 'subsidio');
  assert.equal(res.length, creditos.length);
  assert.ok(res.every((r) => r.programa.categoria !== 'subsidio'));
  for (let k = 1; k < res.length; k++) {
    const [a, b] = [res[k - 1], res[k]];
    assert.ok(a.score > b.score || (a.score === b.score && a.cuotaEstimada <= b.cuotaEstimada), `orden en la posición ${k}`);
  }
});

test('evaluarTodos: no modifica los datos de entrada', () => {
  const copia = JSON.stringify(programas);
  const u = afiliado();
  const uCopia = JSON.stringify(u);
  evaluarTodos(programas, u);
  assert.equal(JSON.stringify(programas), copia);
  assert.equal(JSON.stringify(u), uCopia);
});

// ---------- normalizarPerfil ----------

test('normalizarPerfil: valores por defecto', () => {
  assert.deepEqual(normalizarPerfil({ precioVivienda: 70000, ingresoMensual: 1200 }), {
    precioVivienda: 70000, entradaDisponible: 0, ingresoMensual: 1200, deudasMensuales: 0,
    afiliadoIess: false, aportaciones: 0, edad: 35, uso: 'vivienda_terminada',
    primeraVivienda: true, relacionLaboral: 'dependiente', plazoDeseado: 20,
  });
});

test('normalizarPerfil: conserva lo indicado y convierte textos numéricos', () => {
  const u = normalizarPerfil({
    precioVivienda: '120000', entradaDisponible: 30000, ingresoMensual: '2500', deudasMensuales: 150,
    afiliadoIess: true, aportaciones: 60, edad: 42, uso: 'construccion', primeraVivienda: false,
    relacionLaboral: 'independiente', plazoDeseado: 15, viviendaNueva: false,
  });
  assert.equal(u.precioVivienda, 120000);
  assert.equal(u.ingresoMensual, 2500);
  assert.equal(u.viviendaNueva, false);
  assert.equal(u.uso, 'construccion');
  assert.equal(u.primeraVivienda, false);
});

test('normalizarPerfil: viviendaNueva solo aparece si se indica', () => {
  assert.ok(!('viviendaNueva' in normalizarPerfil({ precioVivienda: 1, ingresoMensual: 1 })));
  assert.ok(!('viviendaNueva' in normalizarPerfil({ precioVivienda: 1, ingresoMensual: 1, viviendaNueva: null })));
  assert.equal(normalizarPerfil({ precioVivienda: 1, ingresoMensual: 1, viviendaNueva: true }).viviendaNueva, true);
});

test('normalizarPerfil: errores por campos obligatorios', () => {
  assert.throws(() => normalizarPerfil(), /Falta el campo obligatorio "precioVivienda"/);
  assert.throws(() => normalizarPerfil({}), /Falta el campo obligatorio "precioVivienda"/);
  assert.throws(() => normalizarPerfil({ precioVivienda: 70000 }), /Falta el campo obligatorio "ingresoMensual"/);
  assert.throws(() => normalizarPerfil({ ingresoMensual: 1200 }), /"precioVivienda"/);
});

test('normalizarPerfil: errores por valores fuera de rango o de tipo incorrecto', () => {
  const ok = { precioVivienda: 70000, ingresoMensual: 1200 };
  const falla = (extra, patron) => assert.throws(() => normalizarPerfil({ ...ok, ...extra }), patron);
  falla({ precioVivienda: 0 }, /"precioVivienda" debe ser un número entre 1 y ∞/);
  falla({ precioVivienda: 'setenta mil' }, /"precioVivienda" debe ser un número/);
  falla({ precioVivienda: Infinity }, /"precioVivienda"/);
  falla({ ingresoMensual: -1 }, /"ingresoMensual" debe ser un número entre 0/);
  falla({ ingresoMensual: NaN }, /"ingresoMensual"/);
  falla({ entradaDisponible: -100 }, /"entradaDisponible"/);
  falla({ deudasMensuales: -1 }, /"deudasMensuales"/);
  falla({ aportaciones: -1 }, /"aportaciones"/);
  falla({ edad: 17 }, /"edad" debe ser un número entre 18 y 100/);
  falla({ edad: 101 }, /"edad"/);
  falla({ plazoDeseado: 0 }, /"plazoDeseado" debe ser un número entre 1 y 40/);
  falla({ plazoDeseado: 41 }, /"plazoDeseado"/);
  falla({ uso: 'oficina' }, /"uso" debe ser uno de: vivienda_terminada/);
  falla({ relacionLaboral: 'estudiante' }, /"relacionLaboral" debe ser uno de: dependiente/);
  falla({ afiliadoIess: 'sí' }, /"afiliadoIess" debe ser true o false/);
  falla({ primeraVivienda: 1 }, /"primeraVivienda" debe ser true o false/);
  falla({ viviendaNueva: 'no' }, /"viviendaNueva" debe ser true o false/);
});

test('normalizarPerfil: acepta los límites', () => {
  const u = normalizarPerfil({ precioVivienda: 1, ingresoMensual: 0, edad: 18, plazoDeseado: 40 });
  assert.equal(u.ingresoMensual, 0);
  assert.equal(normalizarPerfil({ precioVivienda: 1, ingresoMensual: 0, edad: 100, plazoDeseado: 1 }).edad, 100);
});

test('USOS y RELACIONES_LABORALES: todos los valores son aceptados', () => {
  assert.equal(USOS.length, 6);
  assert.equal(RELACIONES_LABORALES.length, 4);
  for (const uso of USOS) assert.equal(perfil({ uso }).uso, uso);
  for (const relacionLaboral of RELACIONES_LABORALES) assert.equal(perfil({ relacionLaboral }).relacionLaboral, relacionLaboral);
});

test('evaluarPerfil: equivale a evaluarTodos(programas, normalizarPerfil(parcial)) y propaga errores', () => {
  const parcial = { precioVivienda: 90000, ingresoMensual: 1800, entradaDisponible: 10000 };
  assert.deepEqual(evaluarPerfil(parcial), evaluarTodos(programas, normalizarPerfil(parcial)));
  assert.throws(() => evaluarPerfil({ precioVivienda: 90000 }), /ingresoMensual/);
});
