const { responder, llamadas } = require('./setup');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { procesarLectura } = require('../src/services/alarmService');
const own = require('../src/services/ownership');
const { transicionValida } = require('../src/controllers/alarmController');
const { proyectarMes } = require('../src/controllers/monitoringdata');

const ctx = {
  codigoSensor: 'SENS-02', codigoDispositivo: 'DISP-01', codigoSala: 'SALA-01', codigoEdificio: 'EDIF-01',
  idUsuario: 1, umbralAlto: 400, umbralBajo: 50, horarioEntrada: '08:00:00', horarioSalida: '18:00:00',
};

test('una lectura alta crea una alarma con su clave de alarma activa', async () => {
  responder([]);
  const creadas = await procesarLectura(ctx, { fechaHora: '2026-11-12 10:00:00', valor: 520 });
  assert.equal(creadas.length, 1);
  assert.match(llamadas[0].sql, /INSERT INTO ALARMAS/);
  assert.equal(llamadas[0].params[0].claveActiva, 'SENS-02|Pico de Consumo');
  assert.match(creadas[0].codigoAlarma, /^AL-[0-9A-F]{16}$/);
});

test('si ya hay una alarma activa del mismo tipo no se duplica', async () => {
  const dup = Object.assign(new Error('Duplicate entry'), { code: 'ER_DUP_ENTRY' });
  responder(dup);
  const creadas = await procesarLectura(ctx, { fechaHora: '2026-11-12 10:05:00', valor: 530 });
  assert.equal(creadas.length, 0);
});

test('un sensor sin dispositivo no genera alarmas', async () => {
  responder();
  assert.deepEqual(await procesarLectura({ ...ctx, codigoDispositivo: null }, { fechaHora: '2026-11-12 10:00:00', valor: 999 }), []);
  assert.equal(llamadas.length, 0);
});

test('un usuario no puede tocar recursos de otra cuenta', async () => {
  responder([]);
  await assert.rejects(own.edificio(2, 'EDIF-01'), (e) => e.status === 404);
  assert.deepEqual(llamadas[0].params, ['EDIF-01', 2]);
  responder([{ codigoEdificio: 'EDIF-01', idUsuario: 1 }]);
  assert.equal((await own.edificio(1, 'EDIF-01')).codigoEdificio, 'EDIF-01');
});

test('el ciclo de vida de la alarma solo avanza', () => {
  assert.ok(transicionValida('ACTIVA', 'ATENDIDA'));
  assert.ok(transicionValida('ATENDIDA', 'CERRADA'));
  assert.ok(transicionValida('ACTIVA', 'CERRADA'));
  assert.ok(!transicionValida('CERRADA', 'ACTIVA'));
  assert.ok(!transicionValida('ATENDIDA', 'ACTIVA'));
});

test('el pronóstico suma el consumo del mes y proyecta con el promedio reciente', () => {
  const hoy = new Date(2026, 10, 12, 12, 0); // 12 de noviembre, mediodía
  const dias = [];
  for (let d = 1; d <= 12; d++) dias.push({ dia: `2026-11-${String(d).padStart(2, '0')}`, kwh: d === 12 ? 5 : 10 });
  const p = proyectarMes(dias, hoy);
  assert.equal(p.consumoActual, 115);      // 11 días × 10 + 5 de hoy
  assert.equal(p.promedioDiario, 10);
  assert.equal(p.diasRestantes, 18.5);      // 30 − 12 + medio día
  assert.equal(p.proyeccion, 300);
  assert.ok(p.confiable);
  assert.equal(proyectarMes([], hoy).proyeccion, 0);
});
