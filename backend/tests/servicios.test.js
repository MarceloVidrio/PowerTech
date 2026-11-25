const { responder, llamadas } = require('./setup');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { procesarLectura, _ultimaRevision } = require('../src/services/alarmService');
const own = require('../src/services/ownership');
const { transicionValida } = require('../src/controllers/alarmController');
const hogarCtrl = require('../src/controllers/hogarController');
const aparatoCtrl = require('../src/controllers/aparatoController');
const programador = require('../src/services/programador');

const ctx = {
  idHogar: 3, idUsuario: 1, nombre: 'Casa', codigoMedidor: 'MED-1', tarifa: '1F', mesInicioVerano: 5,
  umbralAltoW: 5000, consumoBaseW: 300, consumoNocheW: 1500, horaDormirInicio: '23:00:00', horaDormirFin: '06:00:00', modoVacaciones: 0,
};

test('una lectura alta crea un aviso con su clave de aviso activo', async () => {
  _ultimaRevision.set(3, Date.now()); // sin revisión del periodo en esta prueba
  responder([]);
  const creadas = await procesarLectura(ctx, { fechaHora: '2026-11-12 16:00:00', valor: 6000 });
  assert.equal(creadas.length, 1);
  assert.match(llamadas[0].sql, /INSERT INTO ALARMAS/);
  assert.equal(llamadas[0].params[0].claveActiva, '3|Consumo alto');
  assert.equal(llamadas[0].params[0].idHogar, 3);
  assert.match(creadas[0].codigoAlarma, /^AL-[0-9A-F]{16}$/);
});

test('si ya hay un aviso activo del mismo tipo no se duplica', async () => {
  _ultimaRevision.set(3, Date.now());
  responder(Object.assign(new Error('Duplicate entry'), { code: 'ER_DUP_ENTRY' }));
  assert.equal((await procesarLectura(ctx, { fechaHora: '2026-11-12 16:05:00', valor: 6100 })).length, 0);
});

test('cada 30 minutos se revisa el consumo del periodo', async () => {
  _ultimaRevision.delete(3);
  responder([]); // kwhPorDia sin datos → sin avisos del periodo
  await procesarLectura(ctx, { fechaHora: '2026-11-12 16:00:00', valor: 800 });
  assert.equal(llamadas.length, 1);
  assert.match(llamadas[0].sql, /WITH base AS/);
  responder();
  await procesarLectura(ctx, { fechaHora: '2026-11-12 16:01:00', valor: 800 });
  assert.equal(llamadas.length, 0); // ya se revisó hace menos de 30 min
});

test('un usuario no puede ver el hogar ni los aparatos de otra cuenta', async () => {
  responder([]);
  await assert.rejects(own.hogar(2), (e) => e.status === 404);
  assert.deepEqual(llamadas[0].params, [2]);
  responder([]);
  await assert.rejects(own.aparato(2, '5'), (e) => e.status === 404);
  assert.deepEqual(llamadas[0].params, [5, 2]);
});

test('el ciclo de vida del aviso solo avanza', () => {
  assert.ok(transicionValida('ACTIVA', 'ATENDIDA'));
  assert.ok(transicionValida('ATENDIDA', 'CERRADA'));
  assert.ok(!transicionValida('CERRADA', 'ACTIVA'));
});

test('validación de los datos del hogar', () => {
  const d = hogarCtrl.validar({ tarifa: '1f', horaDormirInicio: '23:00', horaDormirFin: '06:30' });
  assert.equal(d.tarifa, '1F');
  assert.equal(d.nombre, 'Mi casa');
  assert.deepEqual([d.consumoBaseW, d.consumoNocheW, d.umbralAltoW], [300, 1500, 5000]);
  assert.throws(() => hogarCtrl.validar({ tarifa: 'GDMTH' }), (e) => e.detalles.some((m) => /tarifa/.test(m)));
  assert.throws(() => hogarCtrl.validar({ consumoNocheW: 6000 }), (e) => e.detalles.some((m) => /límite de consumo alto/.test(m)));
  assert.throws(() => hogarCtrl.validar({ inicioPeriodo: 'ayer' }), (e) => e.status === 400);
});

test('un aparato sin enchufe no puede apagarse solo', () => {
  const a = aparatoCtrl.validar({ nombre: 'Minisplit', tipo: 'minisplit', potenciaW: 1400, horasDia: 9, apagarAlDormir: true });
  assert.equal(a.tipo, 'MINISPLIT');
  assert.equal(a.apagarAlDormir, 0);
  const b = aparatoCtrl.validar({ nombre: 'Boiler', controlUrl: 'http://192.168.1.50', apagarEnVacaciones: true });
  assert.equal(b.apagarEnVacaciones, 1);
  assert.throws(() => aparatoCtrl.validar({ nombre: 'X', controlUrl: 'ftp://x' }), (e) => e.status === 400);
  assert.throws(() => aparatoCtrl.validar({ nombre: 'X', horasDia: 30 }), (e) => e.status === 400);
});

test('al empezar las horas de sueño se apaga cada aparato una sola vez por noche', async () => {
  const fetchOriginal = global.fetch;
  const pedidos = [];
  global.fetch = async (url) => { pedidos.push(String(url)); return { ok: true, json: async () => ({}) }; };
  try {
    programador._apagadosHoy.clear();
    const aparato = { idAparato: 9, nombre: 'TV', controlUrl: 'http://192.168.1.60', horaDormirInicio: '23:00:00', horaDormirFin: '06:00:00' };
    responder([aparato]);
    await programador.revisarHorasDeSueno(new Date(2026, 10, 12, 23, 5));
    assert.equal(pedidos.length, 1);
    assert.match(pedidos[0], /cmnd=Power\+Off/);
    responder([aparato]);
    await programador.revisarHorasDeSueno(new Date(2026, 10, 13, 2, 0)); // misma noche
    assert.equal(pedidos.length, 1);
    responder([aparato]);
    await programador.revisarHorasDeSueno(new Date(2026, 10, 13, 12, 0)); // de día no
    assert.equal(pedidos.length, 1);
    responder([aparato]);
    await programador.revisarHorasDeSueno(new Date(2026, 10, 13, 23, 30)); // noche siguiente
    assert.equal(pedidos.length, 2);
  } finally {
    global.fetch = fetchOriginal;
  }
});
