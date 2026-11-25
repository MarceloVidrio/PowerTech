// Consumo de la casa (kWh) por periodo, para la sección de Consumo.
const db = require('../config/db');
const own = require('../services/ownership');
const { ok, badRequest } = require('../utils/http');
const { ENERGIA_CTE, paramsEnergia, resumenPeriodo, historialPeriodos, estimarAparatos } = require('../services/consumoService');
const { fechaISO, describirTarifa, periodoBimestral } = require('../services/tarifaCFE');

// Franjas del día para comparar en qué momento se gasta más.
const FRANJAS = {
  madrugada: ['00:00:00', '06:00:00'],
  manana: ['06:00:00', '12:00:00'],
  tarde: ['12:00:00', '18:00:00'],
  noche: ['18:00:00', '24:00:00'],
};

// Rango de fechas del mes pedido (por defecto, el actual). Hasta es exclusivo.
function rangoMes(mes, anio) {
  const hoy = new Date();
  const m = Number(mes) || hoy.getMonth() + 1;
  const a = Number(anio) || hoy.getFullYear();
  if (m < 1 || m > 12 || a < 2000 || a > 2100) throw badRequest('Mes o año no válido');
  return { desde: fechaISO(new Date(a, m - 1, 1)), hasta: fechaISO(new Date(a, m, 1)), mes: m, anio: a };
}

async function medidorDelHogar(req) {
  const h = await own.hogar(req.user.owner);
  return h;
}

// GET /consumo/fechas — meses que tienen lecturas
async function fechas(req, res) {
  const h = await medidorDelHogar(req);
  if (!h.codigoMedidor) return ok(res, []);
  const rows = await db.query(`
    SELECT DISTINCT MONTH(fechaHora) AS mes, YEAR(fechaHora) AS anio
    FROM LECTURAS WHERE codigoMedidor = ? ORDER BY anio DESC, mes DESC`, [h.codigoMedidor]);
  ok(res, rows.map((r) => ({ mes: Number(r.mes), anio: Number(r.anio) })));
}

// GET /consumo/mes?mes=&anio=&periodo=dia|semana|mes
// Devuelve el total del mes, la gráfica, el reparto por franja del día y el pico de potencia.
async function mes(req, res) {
  const h = await medidorDelHogar(req);
  const r = rangoMes(req.query.mes, req.query.anio);
  const vacio = { total: 0, grafica: [], franjas: Object.keys(FRANJAS).map((f) => ({ franja: f, kwh: 0 })), picoW: null, diasConDatos: 0 };
  if (!h.codigoMedidor) return ok(res, vacio);

  const agrupacion = { dia: 'HOUR(fechaHora)', semana: 'WEEKDAY(fechaHora)' }[req.query.periodo] || 'DAY(fechaHora)';
  const params = paramsEnergia(h.codigoMedidor, r.desde, r.hasta);
  const [totales, grafica, franjas, pico] = await Promise.all([
    db.query(`${ENERGIA_CTE} SELECT ROUND(SUM(kwh), 4) AS total, COUNT(DISTINCT DATE(fechaHora)) AS dias FROM energia`, params),
    db.query(`${ENERGIA_CTE} SELECT ${agrupacion} AS etiqueta, ROUND(SUM(kwh), 4) AS kwh FROM energia GROUP BY ${agrupacion} ORDER BY etiqueta`, params),
    db.query(`${ENERGIA_CTE}
      SELECT CASE WHEN TIME(fechaHora) < '06:00:00' THEN 'madrugada' WHEN TIME(fechaHora) < '12:00:00' THEN 'manana'
                  WHEN TIME(fechaHora) < '18:00:00' THEN 'tarde' ELSE 'noche' END AS franja,
             ROUND(SUM(kwh), 4) AS kwh
      FROM energia GROUP BY franja`, params),
    db.query('SELECT valor, fechaHora FROM LECTURAS WHERE codigoMedidor = ? AND fechaHora >= ? AND fechaHora < ? ORDER BY valor DESC LIMIT 1',
      [h.codigoMedidor, r.desde, r.hasta]),
  ]);
  const porFranja = new Map(franjas.map((f) => [f.franja, Number(f.kwh) || 0]));
  ok(res, {
    mes: r.mes, anio: r.anio,
    total: Number(totales[0]?.total) || 0,
    diasConDatos: Number(totales[0]?.dias) || 0,
    grafica: grafica.map((g) => ({ etiqueta: Number(g.etiqueta), kwh: Number(g.kwh) || 0 })),
    franjas: Object.keys(FRANJAS).map((f) => ({ franja: f, kwh: porFranja.get(f) || 0 })),
    picoW: pico[0] ? { valor: Number(pico[0].valor), fechaHora: pico[0].fechaHora } : null,
  });
}

// GET /consumo/periodo — resumen del bimestre actual (consumo, pronóstico, recibo estimado, DAC)
async function periodo(req, res) {
  const h = await medidorDelHogar(req);
  ok(res, await resumenPeriodo(h, h.codigoMedidor));
}

// GET /consumo/historial — últimos 6 bimestres (kWh e importe estimado)
async function historial(req, res) {
  const h = await medidorDelHogar(req);
  ok(res, await historialPeriodos(h, h.codigoMedidor, 6));
}

// GET /consumo/aparatos — estimación de lo que gasta cada aparato del inventario,
// comparada con lo que midió el medidor en el periodo.
async function aparatos(req, res) {
  const h = await medidorDelHogar(req);
  const lista = await db.query('SELECT * FROM APARATOS WHERE idHogar = ?', [h.idHogar]);
  const p = periodoBimestral(h.inicioPeriodo);
  ok(res, { periodo: p, aparatos: estimarAparatos(lista, p.diasTotales) });
}

// GET /consumo/tarifa — tabla de la tarifa del hogar para explicarla en la app
async function tarifaHogar(req, res) {
  const h = await medidorDelHogar(req);
  ok(res, describirTarifa(h.tarifa, h.mesInicioVerano));
}

module.exports = { fechas, mes, periodo, historial, aparatos, tarifaHogar, rangoMes, FRANJAS };
