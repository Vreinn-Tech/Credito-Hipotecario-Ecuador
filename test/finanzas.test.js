import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cuotaMensual, tablaAmortizacion, tasaEfectiva, capacidadDeCredito, fmtUSD, fmtPct } from '../src/finanzas.js';

const cerca = (real, esperado, tolerancia = 0.005) =>
  assert.ok(Math.abs(real - esperado) <= tolerancia, `esperado ≈ ${esperado}, recibido ${real}`);

test('cuotaMensual: 65.000 USD al 2,99 % a 30 años ≈ 274 USD (CrediCasa)', () => {
  const cuota = cuotaMensual({ monto: 65000, tasaNominalAnual: 2.99, plazoAnios: 30 });
  cerca(cuota, 273.69);
  assert.equal(Math.round(cuota), 274);
});

test('cuotaMensual: valores conocidos del sistema francés', () => {
  // 100.000 al 6 % a 30 años = 599,55; 100.000 al 10 % a 20 años = 965,02; 1.000 al 12 % a 1 año = 88,85
  cerca(cuotaMensual({ monto: 100000, tasaNominalAnual: 6, plazoAnios: 30 }), 599.55);
  cerca(cuotaMensual({ monto: 100000, tasaNominalAnual: 10, plazoAnios: 20 }), 965.02);
  cerca(cuotaMensual({ monto: 1000, tasaNominalAnual: 12, plazoAnios: 1 }), 88.85);
});

test('cuotaMensual: tasa 0 reparte el capital en partes iguales', () => {
  assert.equal(cuotaMensual({ monto: 12000, tasaNominalAnual: 0, plazoAnios: 10 }), 100);
});

test('cuotaMensual: monto o plazo no positivos devuelven 0', () => {
  assert.equal(cuotaMensual({ monto: 0, tasaNominalAnual: 8, plazoAnios: 20 }), 0);
  assert.equal(cuotaMensual({ monto: -5, tasaNominalAnual: 8, plazoAnios: 20 }), 0);
  assert.equal(cuotaMensual({ monto: 50000, tasaNominalAnual: 8, plazoAnios: 0 }), 0);
});

test('cuotaMensual: es proporcional al monto y baja al alargar el plazo', () => {
  const base = cuotaMensual({ monto: 50000, tasaNominalAnual: 8.5, plazoAnios: 15 });
  cerca(cuotaMensual({ monto: 100000, tasaNominalAnual: 8.5, plazoAnios: 15 }), base * 2, 1e-9);
  assert.ok(cuotaMensual({ monto: 50000, tasaNominalAnual: 8.5, plazoAnios: 20 }) < base);
});

test('tablaAmortizacion: cuadra capital, intereses y saldo final', () => {
  const p = { monto: 65000, tasaNominalAnual: 2.99, plazoAnios: 30 };
  const a = tablaAmortizacion(p);
  assert.equal(a.tabla.length, 360);
  assert.equal(a.cuota, cuotaMensual(p));
  cerca(a.totalPagado, a.cuota * 360, 1e-6);
  cerca(a.totalIntereses, a.totalPagado - p.monto, 1e-6);
  cerca(a.totalIntereses, 33529.19, 0.01);
  cerca(a.tabla.reduce((s, f) => s + f.capital, 0), p.monto, 1e-6);
  cerca(a.tabla.at(-1).saldo, 0, 1e-6);
});

test('tablaAmortizacion: primera cuota y evolución', () => {
  const a = tablaAmortizacion({ monto: 1000, tasaNominalAnual: 12, plazoAnios: 0.5 });
  assert.equal(a.tabla.length, 6);
  const [f1] = a.tabla;
  assert.equal(f1.n, 1);
  cerca(f1.interes, 10, 1e-9); // 1 % mensual de 1.000
  cerca(f1.capital, a.cuota - 10, 1e-9);
  cerca(f1.saldo, 1000 - f1.capital, 1e-9);
  for (let k = 1; k < a.tabla.length; k++) {
    assert.ok(a.tabla[k].interes < a.tabla[k - 1].interes, 'el interés baja en cada cuota');
    assert.ok(a.tabla[k].capital > a.tabla[k - 1].capital, 'el capital sube en cada cuota');
    assert.ok(a.tabla[k].saldo < a.tabla[k - 1].saldo, 'el saldo baja en cada cuota');
  }
});

test('tasaEfectiva: nominal con capitalización mensual', () => {
  cerca(tasaEfectiva(2.99), 3.03);
  cerca(tasaEfectiva(4.88), 4.99);
  cerca(tasaEfectiva(12), 12.6825, 0.0001);
  assert.equal(tasaEfectiva(0), 0);
});

test('capacidadDeCredito: es la inversa de cuotaMensual', () => {
  const capacidad = capacidadDeCredito(1200, 2.99, 30, 0.4);
  cerca(cuotaMensual({ monto: capacidad, tasaNominalAnual: 2.99, plazoAnios: 30 }), 480, 1e-6);
  cerca(capacidad, 113996.68, 0.5);
});

test('capacidadDeCredito: ratio por defecto 0,35 y tasa 0', () => {
  assert.equal(capacidadDeCredito(1000, 8, 20), capacidadDeCredito(1000, 8, 20, 0.35));
  cerca(capacidadDeCredito(1000, 0, 10, 0.3), 36000, 1e-9);
  assert.equal(capacidadDeCredito(0, 8, 20), 0);
});

test('fmtUSD y fmtPct: formato de Ecuador', () => {
  assert.equal(fmtUSD(65000), '$65.000');
  assert.equal(fmtUSD(273.692, 2), '$273,69');
  assert.equal(fmtPct(2.99), '2,99 %');
  assert.equal(fmtPct(6.8), '6,80 %');
  assert.equal(fmtPct(40, 0), '40 %');
});
