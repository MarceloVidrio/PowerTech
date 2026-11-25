// Cálculo del consumo de energía del hogar a partir de las lecturas del medidor.
//
// Las lecturas guardan POTENCIA instantánea (W), no energía. La energía (kWh)
// se obtiene integrando la potencia en el tiempo:
//
//   kWh del intervalo = promedio(W anterior, W actual) × segundos / 3,600,000
//
// Si entre dos lecturas pasaron más de MAX_INTERVALO_SEG (medidor apagado o sin
// conexión), ese intervalo cuenta como 0: no se sabe qué pasó y no se inventa consumo.
const db = require('../config/db');
const tarifa = require('./tarifaCFE');

const MAX_INTERVALO_SEG = 15 * 60;

// CTE "energia": una fila por lectura del medidor entre ? y ? con su kWh.
// Se leen 15 minutos antes del inicio para poder calcular el primer intervalo.
const ENERGIA_CTE = `
  WITH base AS (
    SELECT fechaHora, valor,
           LAG(fechaHora) OVER w AS fechaPrevia,
           LAG(valor)     OVER w AS valorPrevio
    FROM LECTURAS
    WHERE codigoMedidor = ? AND fechaHora >= ? - INTERVAL ${MAX_INTERVALO_SEG} SECOND AND fechaHora < ?
    WINDOW w AS (ORDER BY fechaHora)
  ),
  energia AS (
    SELECT fechaHora, valor,
      CASE
        WHEN fechaPrevia IS NULL THEN 0
        WHEN TIMESTAMPDIFF(SECOND, fechaPrevia, fechaHora) > ${MAX_INTERVALO_SEG} THEN 0
        ELSE (valorPrevio + valor) / 2 * TIMESTAMPDIFF(SECOND, fechaPrevia, fechaHora) / 3600000
      END AS kwh
    FROM base
    WHERE fechaHora >= ?
  )
`;
// Parámetros del CTE: medidor, desde, hasta, desde
const paramsEnergia = (medidor, desde, hasta) => [medidor, desde, hasta, desde];

// kWh por día entre desde y hasta (fechas 'YYYY-MM-DD', hasta exclusivo).
async function kwhPorDia(codigoMedidor, desde, hasta) {
  if (!codigoMedidor) return [];
  const rows = await db.query(`${ENERGIA_CTE}
    SELECT DATE_FORMAT(fechaHora, '%Y-%m-%d') AS dia, SUM(kwh) AS kwh
    FROM energia GROUP BY DATE_FORMAT(fechaHora, '%Y-%m-%d') ORDER BY dia`, paramsEnergia(codigoMedidor, desde, hasta));
  return rows.map((r) => ({ dia: String(r.dia).slice(0, 10), kwh: Number(r.kwh) || 0 }));
}

/*
 * Resumen del periodo bimestral actual: lo consumido, el pronóstico al cierre,
 * el recibo estimado (actual y proyectado) y el riesgo de pasar a tarifa DAC.
 * diasPorDia: [{ dia, kwh }] desde 14 días antes del periodo hasta hoy.
 * Función pura: recibe los datos ya consultados.
 */
function calcularResumen(hogar, dias, hoy = new Date()) {
  const p = tarifa.periodoBimestral(hogar.inicioPeriodo, hoy);
  const hoyISO = tarifa.fechaISO(hoy);
  const hace14 = tarifa.fechaISO(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 14));
  const r2 = (n) => Math.round(n * 100) / 100;

  // Lo consumido por mes dentro del periodo y el promedio de los últimos 14 días completos
  const porMes = new Map();
  let consumido = 0, sumaReciente = 0;
  const diasRecientes = new Set();
  for (const d of dias) {
    if (d.dia >= p.inicio && d.dia < p.fin && d.dia <= hoyISO) {
      consumido += d.kwh;
      porMes.set(d.dia.slice(0, 7), (porMes.get(d.dia.slice(0, 7)) || 0) + d.kwh);
    }
    if (d.dia >= hace14 && d.dia < hoyISO) { sumaReciente += d.kwh; diasRecientes.add(d.dia); }
  }
  const promedioDiario = diasRecientes.size ? sumaReciente / diasRecientes.size : (p.diasTranscurridos >= 1 ? consumido / p.diasTranscurridos : 0);
  const restante = promedioDiario * p.diasRestantes;

  // Meses del periodo: lo real hasta hoy y, para lo que falta, el promedio diario.
  const meses = tarifa.mesesDelPeriodo(p.inicio, p.fin);
  const ahora = (hoy.getHours() * 60 + hoy.getMinutes()) / 1440;
  const mesesActual = meses.map((m) => ({ ...m, kwh: porMes.get(`${m.anio}-${String(m.mes).padStart(2, '0')}`) || 0 }));
  const mesesProyectados = mesesActual.map((m) => {
    const inicioMes = new Date(m.anio, m.mes - 1, 1);
    const finMes = new Date(m.anio, m.mes, 1);
    const ini = new Date(Math.max(inicioMes, new Date(p.inicio + 'T00:00:00')));
    const fin = new Date(Math.min(finMes, new Date(p.fin + 'T00:00:00')));
    const hoyNum = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime() + ahora * 86400000;
    const futuros = Math.max(0, (fin - Math.max(ini, hoyNum)) / 86400000);
    return { ...m, kwh: m.kwh + promedioDiario * futuros };
  });

  const proyeccion = consumido + restante;
  const kwhMensualEstimado = (proyeccion / p.diasTotales) * 30.4;
  const limite = tarifa.limiteDAC(hogar.tarifa);
  const base = { tarifa: hogar.tarifa, mesInicioVerano: hogar.mesInicioVerano };
  return {
    periodo: p,
    consumido: r2(consumido),
    promedioDiario: r2(promedioDiario),
    proyeccion: r2(proyeccion),
    diasConDatos: diasRecientes.size,
    confiable: diasRecientes.size >= 3,
    reciboActual: tarifa.calcularRecibo({ ...base, meses: mesesActual.map((m) => ({ ...m, dias: m.dias })) }),
    reciboProyectado: tarifa.calcularRecibo({ ...base, meses: mesesProyectados }),
    reciboSiFueraDAC: tarifa.calcularRecibo({ ...base, meses: mesesProyectados, dac: true }),
    dac: {
      limiteMensual: limite,
      kwhMensualEstimado: r2(kwhMensualEstimado),
      porcentaje: Math.round((kwhMensualEstimado / limite) * 100),
      enRiesgo: kwhMensualEstimado > limite * 0.9,
    },
    meta: hogar.metaBimestralKwh ? {
      kwh: Number(hogar.metaBimestralKwh),
      porcentaje: Math.round((proyeccion / Number(hogar.metaBimestralKwh)) * 100),
      superada: proyeccion > Number(hogar.metaBimestralKwh),
    } : null,
  };
}

async function resumenPeriodo(hogar, codigoMedidor, hoy = new Date()) {
  const p = tarifa.periodoBimestral(hogar.inicioPeriodo, hoy);
  const desdeD = new Date(Math.min(new Date(p.inicio + 'T00:00:00'), new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 15)));
  const manana = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1);
  const dias = await kwhPorDia(codigoMedidor, tarifa.fechaISO(desdeD), tarifa.fechaISO(manana));
  return calcularResumen(hogar, dias, hoy);
}

/*
 * Historial de los últimos N periodos bimestrales (el actual incluido), como la
 * gráfica de "consumo histórico" del recibo de CFE. Función pura.
 * dias: [{ dia, kwh }] que cubren los periodos.
 */
function calcularHistorial(hogar, dias, n = 6, hoy = new Date()) {
  const actual = tarifa.periodoBimestral(hogar.inicioPeriodo, hoy);
  const [a, m, d] = actual.inicio.split('-').map(Number);
  const periodos = [];
  for (let i = n - 1; i >= 0; i--) {
    const ini = tarifa.sumarMeses(new Date(a, m - 1, d), -2 * i);
    const fin = tarifa.sumarMeses(ini, 2);
    periodos.push({ inicio: tarifa.fechaISO(ini), fin: tarifa.fechaISO(fin), actual: i === 0 });
  }
  return periodos.map((p) => {
    const porMes = new Map();
    let total = 0;
    for (const x of dias) {
      if (x.dia >= p.inicio && x.dia < p.fin) {
        total += x.kwh;
        porMes.set(x.dia.slice(0, 7), (porMes.get(x.dia.slice(0, 7)) || 0) + x.kwh);
      }
    }
    const meses = tarifa.mesesDelPeriodo(p.inicio, p.fin)
      .map((mm) => ({ ...mm, kwh: porMes.get(`${mm.anio}-${String(mm.mes).padStart(2, '0')}`) || 0 }));
    const recibo = total > 0 ? tarifa.calcularRecibo({ tarifa: hogar.tarifa, mesInicioVerano: hogar.mesInicioVerano, meses }) : null;
    return { ...p, kwh: Math.round(total * 10) / 10, importe: recibo ? recibo.total : 0, conDatos: total > 0 };
  });
}

async function historialPeriodos(hogar, codigoMedidor, n = 6, hoy = new Date()) {
  const actual = tarifa.periodoBimestral(hogar.inicioPeriodo, hoy);
  const [a, m, d] = actual.inicio.split('-').map(Number);
  const desde = tarifa.fechaISO(tarifa.sumarMeses(new Date(a, m - 1, d), -2 * (n - 1)));
  const dias = await kwhPorDia(codigoMedidor, desde, actual.fin);
  return calcularHistorial(hogar, dias, n, hoy);
}

// Estimación del consumo de cada aparato del inventario (potencia × horas de uso).
function estimarAparatos(aparatos, diasPeriodo = 61) {
  const lista = aparatos.map((a) => {
    const kwhDia = a.potenciaW && a.horasDia ? (Number(a.potenciaW) * Number(a.horasDia)) / 1000 : 0;
    return { idAparato: a.idAparato, nombre: a.nombre, tipo: a.tipo, cuarto: a.cuarto, kwhDia: Math.round(kwhDia * 100) / 100, kwhBimestre: Math.round(kwhDia * diasPeriodo * 10) / 10 };
  });
  const total = lista.reduce((s, a) => s + a.kwhBimestre, 0);
  return lista
    .map((a) => ({ ...a, porcentaje: total ? Math.round((a.kwhBimestre / total) * 100) : 0 }))
    .sort((a, b) => b.kwhBimestre - a.kwhBimestre);
}

module.exports = { ENERGIA_CTE, paramsEnergia, kwhPorDia, calcularResumen, resumenPeriodo, calcularHistorial, historialPeriodos, estimarAparatos, MAX_INTERVALO_SEG };
