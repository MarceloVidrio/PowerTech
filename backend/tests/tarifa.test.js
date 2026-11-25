require('./setup');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const t = require('../src/services/tarifaCFE');
const { calcularResumen, estimarAparatos } = require('../src/services/consumoService');

test('el verano dura 6 meses desde el mes de inicio y la tarifa 1 no tiene verano', () => {
  assert.ok(t.esVerano(5, '1F', 5));
  assert.ok(t.esVerano(10, '1F', 5));
  assert.ok(!t.esVerano(11, '1F', 5));
  assert.ok(!t.esVerano(4, '1F', 5));
  assert.ok(t.esVerano(1, '1F', 11)); // verano nov–abr cruza el año
  assert.ok(!t.esVerano(7, '1', 5));
});

test('fuera de verano un bimestre de 300 kWh en 1F se reparte en básico, intermedio y excedente', () => {
  const r = t.calcularRecibo({ tarifa: '1F', meses: [{ anio: 2026, mes: 11, dias: 30, kwh: 150 }, { anio: 2026, mes: 12, dias: 31, kwh: 150 }] });
  const kwh = Object.fromEntries(r.escalones.map((e) => [e.clave, e.kwh]));
  assert.equal(kwh.basico, 150);      // 75 × 2 meses
  assert.equal(kwh.intermedio, 150);  // el resto cabe en 125 × 2
  assert.equal(kwh.excedente, 0);
  assert.equal(r.kwh, 300);
  assert.equal(r.energia, Math.round((150 * 1.125 + 150 * 1.369) * 100) / 100);
  assert.equal(r.total, Math.round(r.energia * 1.16 * 100) / 100);
  assert.equal(r.escalonActual, 'Intermedio');
});

test('en verano la 1F tiene escalones mucho más amplios', () => {
  const r = t.calcularRecibo({ tarifa: '1F', mesInicioVerano: 5, meses: [{ anio: 2026, mes: 7, dias: 31, kwh: 1000 }, { anio: 2026, mes: 8, dias: 31, kwh: 1000 }] });
  const e = Object.fromEntries(r.escalones.map((x) => [x.clave, x.kwh]));
  assert.equal(e.basico, 600);
  assert.equal(e.intermedioBajo, 1400);
  assert.equal(e.excedente, 0);
});

test('se cobra el mínimo de 25 kWh por mes y la DAC no tiene subsidio', () => {
  const minimo = t.calcularRecibo({ tarifa: '1', meses: [{ anio: 2026, mes: 3, dias: 31, kwh: 5 }, { anio: 2026, mes: 4, dias: 30, kwh: 5 }] });
  assert.equal(minimo.kwhCobrado, 50);
  const meses = [{ anio: 2026, mes: 3, dias: 31, kwh: 300 }, { anio: 2026, mes: 4, dias: 30, kwh: 300 }];
  assert.ok(t.calcularRecibo({ tarifa: '1', meses, dac: true }).total > t.calcularRecibo({ tarifa: '1', meses }).total);
});

test('el periodo bimestral se calcula desde la fecha del recibo', () => {
  const p = t.periodoBimestral('2026-01-15', new Date(2026, 10, 20, 12));
  assert.equal(p.inicio, '2026-11-15');
  assert.equal(p.fin, '2027-01-15');
  assert.equal(p.diasTotales, 61);
  const cal = t.periodoBimestral(null, new Date(2026, 10, 20));
  assert.deepEqual([cal.inicio, cal.fin], ['2026-11-01', '2027-01-01']);
  assert.deepEqual(t.mesesDelPeriodo('2026-11-15', '2027-01-15').map((m) => m.dias), [16, 31, 14]);
});

test('el resumen del bimestre proyecta el cierre con el promedio de los últimos días', () => {
  const hogar = { tarifa: '1F', mesInicioVerano: 5, inicioPeriodo: '2026-11-01', metaBimestralKwh: 500 };
  const dias = [];
  for (let d = 1; d <= 19; d++) dias.push({ dia: `2026-11-${String(d).padStart(2, '0')}`, kwh: 10 });
  dias.push({ dia: '2026-11-20', kwh: 5 });
  const r = calcularResumen(hogar, dias, new Date(2026, 10, 20, 12, 0));
  assert.equal(r.consumido, 195);
  assert.equal(r.promedioDiario, 10);
  assert.equal(r.periodo.diasTotales, 61);
  assert.equal(r.proyeccion, Math.round((195 + 10 * 41.5) * 100) / 100); // faltan 41.5 días
  assert.ok(r.confiable);
  assert.equal(r.meta.superada, true);
  assert.equal(r.dac.limiteMensual, 2500);
  assert.ok(r.reciboProyectado.total > r.reciboActual.total);
  assert.equal(Math.round(r.reciboProyectado.kwh), Math.round(r.proyeccion));
});

test('la estimación por aparato usa potencia × horas de uso', () => {
  const r = estimarAparatos([
    { idAparato: 1, nombre: 'Minisplit', potenciaW: 1400, horasDia: 10 },
    { idAparato: 2, nombre: 'Refri', potenciaW: 150, horasDia: 24 },
    { idAparato: 3, nombre: 'Sin datos' },
  ], 60);
  assert.equal(r[0].nombre, 'Minisplit');
  assert.equal(r[0].kwhDia, 14);
  assert.equal(r[0].kwhBimestre, 840);
  assert.equal(r[1].kwhBimestre, 216);
  assert.equal(r[0].porcentaje, 80);
  assert.equal(r[2].kwhBimestre, 0);
});

test('el historial muestra los últimos 6 bimestres con su consumo e importe', () => {
  const { calcularHistorial } = require('../src/services/consumoService');
  const hogar = { tarifa: '1F', mesInicioVerano: 5, inicioPeriodo: '2026-11-01' };
  const dias = [{ dia: '2026-09-15', kwh: 400 }, { dia: '2026-11-12', kwh: 30 }, { dia: '2026-11-13', kwh: 20 }];
  const h = calcularHistorial(hogar, dias, 6, new Date(2026, 10, 20));
  assert.equal(h.length, 6);
  assert.deepEqual([h[0].inicio, h[5].inicio], ['2026-01-01', '2026-11-01']);
  assert.ok(h[5].actual);
  assert.equal(h[5].kwh, 50);
  assert.equal(h[4].kwh, 400);       // sep–oct
  assert.ok(h[4].importe > 0);
  assert.equal(h[0].conDatos, false);
});
