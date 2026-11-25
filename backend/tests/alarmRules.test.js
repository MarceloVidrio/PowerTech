require('./setup');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { evaluarLectura, evaluarPeriodo, enRango, TIPOS } = require('../src/services/alarmRules');

const casa = { umbralAltoW: 5000, consumoBaseW: 300, consumoNocheW: 1500, horaDormirInicio: '23:00:00', horaDormirFin: '06:00:00', modoVacaciones: false };

test('un consumo normal de día no genera avisos', () => {
  assert.deepEqual(evaluarLectura({ ...casa, valor: 2200, fechaHora: '2026-11-12 16:00:00' }), []);
});

test('consumo alto: nivel 4, y nivel 5 si supera 150 %', () => {
  const [a] = evaluarLectura({ ...casa, valor: 5600, fechaHora: '2026-11-12 16:00:00' });
  assert.equal(a.tipo, TIPOS.ALTO);
  assert.equal(a.nivel, 4);
  assert.equal(evaluarLectura({ ...casa, valor: 8000, fechaHora: '2026-11-12 16:00:00' })[0].nivel, 5);
});

test('las horas de sueño pueden cruzar la medianoche', () => {
  assert.ok(enRango('23:30:00', '23:00', '06:00'));
  assert.ok(enRango('02:00:00', '23:00', '06:00'));
  assert.ok(!enRango('06:00:00', '23:00', '06:00'));
  assert.ok(!enRango('12:00:00', '23:00', '06:00'));
  assert.ok(enRango('01:00:00', '00:00', '06:00'));
});

test('consumo de más en horas de sueño genera aviso nivel 2; el normal de noche no', () => {
  const r = evaluarLectura({ ...casa, valor: 2100, fechaHora: '2026-11-12 02:30:00' });
  assert.deepEqual(r.map((a) => [a.tipo, a.nivel]), [[TIPOS.SUENO, 2]]);
  assert.deepEqual(evaluarLectura({ ...casa, valor: 1200, fechaHora: '2026-11-12 02:30:00' }), []);
});

test('en modo vacaciones avisa cualquier consumo arriba del mínimo (y no el de sueño)', () => {
  const r = evaluarLectura({ ...casa, modoVacaciones: true, valor: 900, fechaHora: '2026-11-12 02:30:00' });
  assert.deepEqual(r.map((a) => [a.tipo, a.nivel]), [[TIPOS.VACACIONES, 4]]);
  assert.deepEqual(evaluarLectura({ ...casa, modoVacaciones: true, valor: 250, fechaHora: '2026-11-12 12:00:00' }), []);
});

test('avisos del periodo: meta bimestral y riesgo de DAC', () => {
  const r = evaluarPeriodo({ proyeccionKwh: 1300, metaBimestralKwh: 1000, kwhMensualEstimado: 2600, limiteDAC: 2500 });
  assert.deepEqual(r.map((a) => a.tipo), [TIPOS.META, TIPOS.DAC]);
  assert.deepEqual(evaluarPeriodo({ proyeccionKwh: 800, metaBimestralKwh: 1000, kwhMensualEstimado: 400, limiteDAC: 2500 }), []);
  // con pocos datos no se avisa
  assert.deepEqual(evaluarPeriodo({ proyeccionKwh: 9999, metaBimestralKwh: 1, kwhMensualEstimado: 9999, limiteDAC: 1, confiable: false }), []);
});
