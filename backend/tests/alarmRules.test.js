require('./setup');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { evaluarLectura, TIPOS } = require('../src/services/alarmRules');

const base = { umbralAlto: 400, umbralBajo: 50, horarioEntrada: '08:00:00', horarioSalida: '18:00:00' };

test('una lectura normal en horario no genera alarmas', () => {
  assert.deepEqual(evaluarLectura({ ...base, valor: 250, fechaHora: '2026-11-12 10:00:00' }), []);
});

test('un pico sobre el umbral alto genera nivel 4, y nivel 5 si supera 150 %', () => {
  const [a] = evaluarLectura({ ...base, valor: 500, fechaHora: '2026-11-12 10:00:00' });
  assert.equal(a.tipo, TIPOS.PICO);
  assert.equal(a.nivel, 4);
  assert.equal(evaluarLectura({ ...base, valor: 700, fechaHora: '2026-11-12 10:00:00' })[0].nivel, 5);
});

test('consumo fuera de horario genera alarma de nivel 3', () => {
  const r = evaluarLectura({ ...base, valor: 220, fechaHora: '2026-11-12 21:30:00' });
  assert.deepEqual(r.map((a) => [a.tipo, a.nivel]), [[TIPOS.FUERA_HORARIO, 3]]);
  // a la hora exacta de salida ya está fuera de horario
  assert.equal(evaluarLectura({ ...base, valor: 220, fechaHora: '2026-11-12T18:00:00' }).length, 1);
});

test('consumo "fantasma" bajo el umbral bajo fuera de horario no genera alarma', () => {
  assert.deepEqual(evaluarLectura({ ...base, valor: 30, fechaHora: '2026-11-12 23:00:00' }), []);
});

test('consumo bajo dentro del horario avisa de equipo apagado o sensor desconectado', () => {
  const [a] = evaluarLectura({ ...base, valor: 0, fechaHora: '2026-11-12 11:00:00' });
  assert.equal(a.tipo, TIPOS.BAJO);
  assert.equal(a.nivel, 2);
});

test('sin umbrales configurados no se genera nada', () => {
  assert.deepEqual(evaluarLectura({ valor: 9999, fechaHora: '2026-11-12 11:00:00' }), []);
});
