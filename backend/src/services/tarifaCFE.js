// Tarifas domésticas de CFE (1, 1A a 1F y DAC) y cálculo del recibo bimestral.
// Funciones puras (sin base de datos) para poder probarlas fácilmente.
//
// ⚠ PRECIOS DE REFERENCIA (pesos por kWh, sin IVA). CFE los ajusta cada mes:
//   para que el costo estimado coincida con tu recibo, copia aquí los precios
//   que aparecen en él (o en https://app.cfe.mx/Aplicaciones/CCFE/Tarifas/).
//
// Cómo cobra CFE a una casa:
//  · El consumo se divide en escalones (básico, intermedio y excedente). Cada
//    escalón tiene un límite MENSUAL de kWh; como el recibo es bimestral, en un
//    periodo de dos meses los límites se duplican.
//  · En las tarifas 1A a 1F los límites son más amplios durante los 6 meses de
//    verano (subsidio por calor). Culiacán, Sinaloa, es tarifa 1F.
//  · Si el promedio mensual de los últimos 12 meses supera el límite de "alto
//    consumo", la casa pasa a la tarifa DAC, que no tiene subsidio.

const PRECIOS = {
  verano: { basico: 0.81, intermedio: 0.98, intermedioBajo: 0.98, intermedioAlto: 1.26, excedente: 4.004 },
  fueraVerano: { basico: 1.125, intermedio: 1.369, excedente: 4.004 },
  dac: { kwh: 6.4, cargoFijoMensual: 142.41 },
  // Costo real de llevar la energía a una casa (sin subsidio), desglosado como
  // en la sección "Costo de producción" del recibo de CFE. El apoyo
  // gubernamental es la diferencia entre este costo y lo que se factura.
  // Valores de referencia de tarifa doméstica en baja tensión (región noroeste).
  produccion: {
    suministroMensual: 45.0,
    porKwh: [
      ['Distribución', 0.98],
      ['Transmisión', 0.12],
      ['Operación CENACE', 0.012],
      ['Energía', 1.38],
      ['Capacidad', 0.27],
      ['SCnMEM', 0.008],
    ],
  },
};
const IVA = 0.16;
const MINIMO_MENSUAL_KWH = 25;

const NOMBRES = {
  basico: 'Básico', intermedio: 'Intermedio', intermedioBajo: 'Intermedio bajo',
  intermedioAlto: 'Intermedio alto', excedente: 'Excedente',
};

// Costo de producción del periodo (sin IVA) y apoyo gubernamental = costo − facturado.
function costoProduccion(kwhCobrado, mesesEquivalentes, facturado) {
  const P = PRECIOS.produccion;
  const conceptos = [
    { concepto: 'Suministro', importe: r2(P.suministroMensual * mesesEquivalentes) },
    ...P.porKwh.map(([concepto, precio]) => ({ concepto, precio, importe: r2(kwhCobrado * precio) })),
  ];
  const total = r2(conceptos.reduce((s, c) => s + c.importe, 0));
  return { conceptos, total, apoyo: r2(Math.max(0, total - facturado)) };
}

// Límites mensuales de cada escalón (kWh). El último escalón no tiene límite.
const TARIFAS = {
  1: { dac: 250, verano: [['basico', 75], ['intermedio', 65], ['excedente']], fueraVerano: [['basico', 75], ['intermedio', 65], ['excedente']], sinVerano: true },
  '1A': { dac: 300, verano: [['basico', 100], ['intermedio', 50], ['excedente']], fueraVerano: [['basico', 75], ['intermedio', 75], ['excedente']] },
  '1B': { dac: 400, verano: [['basico', 125], ['intermedio', 100], ['excedente']], fueraVerano: [['basico', 75], ['intermedio', 100], ['excedente']] },
  '1C': { dac: 850, verano: [['basico', 150], ['intermedioBajo', 150], ['intermedioAlto', 150], ['excedente']], fueraVerano: [['basico', 75], ['intermedio', 100], ['excedente']] },
  '1D': { dac: 1000, verano: [['basico', 175], ['intermedioBajo', 225], ['intermedioAlto', 200], ['excedente']], fueraVerano: [['basico', 75], ['intermedio', 125], ['excedente']] },
  '1E': { dac: 2000, verano: [['basico', 300], ['intermedioBajo', 450], ['intermedioAlto', 150], ['excedente']], fueraVerano: [['basico', 75], ['intermedio', 125], ['excedente']] },
  '1F': { dac: 2500, verano: [['basico', 300], ['intermedioBajo', 900], ['intermedioAlto', 1300], ['excedente']], fueraVerano: [['basico', 75], ['intermedio', 125], ['excedente']] },
};
const CODIGOS = Object.keys(TARIFAS);

const r2 = (n) => Math.round(n * 100) / 100;
const diasDelMes = (anio, mes) => new Date(anio, mes, 0).getDate(); // mes 1-12

// ¿El mes (1-12) está dentro de los 6 meses de verano que empiezan en mesInicio?
function esVerano(mes, tarifa = '1F', mesInicio = 5) {
  const t = TARIFAS[tarifa] || TARIFAS['1F'];
  if (t.sinVerano) return false;
  return (mes - mesInicio + 12) % 12 < 6;
}

function limiteDAC(tarifa) {
  return (TARIFAS[tarifa] || TARIFAS['1F']).dac;
}

// Escalones de un mes, con los límites multiplicados por "fraccion"
// (la parte del mes que cae dentro del periodo del recibo).
function escalonesDelMes(tarifa, verano, fraccion = 1) {
  const t = TARIFAS[tarifa] || TARIFAS['1F'];
  const precios = verano ? PRECIOS.verano : PRECIOS.fueraVerano;
  return (verano ? t.verano : t.fueraVerano).map(([clave, limite]) => ({
    clave,
    nombre: NOMBRES[clave],
    limite: limite === undefined ? null : limite * fraccion,
    precio: precios[clave] ?? precios.intermedio,
  }));
}

// Reparte un consumo entre los escalones y calcula el importe de cada uno.
function repartir(kwh, escalones) {
  let resto = Math.max(0, kwh);
  return escalones.map((e) => {
    const usado = e.limite === null ? resto : Math.min(resto, e.limite);
    resto -= usado;
    return { ...e, kwh: usado, importe: usado * e.precio };
  });
}

/*
 * Recibo estimado de un periodo.
 *  meses: [{ anio, mes, kwh, dias }]  (dias = días de ese mes que caen en el periodo)
 *  Devuelve los escalones sumados, el subtotal de energía, el IVA y el total.
 *  Con dac=true se cobra como tarifa DAC (sin subsidio).
 */
function calcularRecibo({ meses, tarifa = '1F', mesInicioVerano = 5, dac = false }) {
  const totalKwh = meses.reduce((s, m) => s + (Number(m.kwh) || 0), 0);
  const mesesEquivalentes = meses.reduce((s, m) => s + m.dias / diasDelMes(m.anio, m.mes), 0);
  const kwhCobrado = Math.max(totalKwh, MINIMO_MENSUAL_KWH * mesesEquivalentes);

  if (dac) {
    const energia = kwhCobrado * PRECIOS.dac.kwh + PRECIOS.dac.cargoFijoMensual * mesesEquivalentes;
    const iva = energia * IVA;
    return {
      tarifa: 'DAC', kwh: r2(totalKwh), kwhCobrado: r2(kwhCobrado),
      escalones: [{ clave: 'dac', nombre: 'Alto consumo (DAC)', kwh: r2(kwhCobrado), precio: PRECIOS.dac.kwh, importe: r2(kwhCobrado * PRECIOS.dac.kwh), limite: null }],
      cargoFijo: r2(PRECIOS.dac.cargoFijoMensual * mesesEquivalentes),
      produccion: { ...costoProduccion(kwhCobrado, mesesEquivalentes, energia), apoyo: 0 },
      energia: r2(energia), iva: r2(iva), total: r2(energia + iva),
    };
  }

  // Cada mes se reparte con sus propios escalones (verano o no), proporcionales
  // a los días que aporta al periodo. Si no hay desglose de kWh por mes, se
  // reparte el total según los días.
  const conKwh = meses.some((m) => Number(m.kwh) > 0);
  const totalDias = meses.reduce((s, m) => s + m.dias, 0) || 1;
  const acumulado = new Map();
  for (const m of meses) {
    const fraccion = m.dias / diasDelMes(m.anio, m.mes);
    const kwhMes = (conKwh ? Number(m.kwh) || 0 : 0) + (kwhCobrado - (conKwh ? totalKwh : 0)) * (m.dias / totalDias);
    const verano = esVerano(m.mes, tarifa, mesInicioVerano);
    for (const e of repartir(kwhMes, escalonesDelMes(tarifa, verano, fraccion))) {
      const clave = `${e.clave}|${verano ? 'v' : 'f'}`;
      const a = acumulado.get(clave) || { clave: e.clave, nombre: e.nombre + (TARIFAS[tarifa]?.sinVerano ? '' : verano ? ' (verano)' : ''), kwh: 0, importe: 0, precio: e.precio, limite: 0 };
      a.kwh += e.kwh;
      a.importe += e.importe;
      a.limite = e.limite === null || a.limite === null ? null : a.limite + e.limite;
      acumulado.set(clave, a);
    }
  }
  const escalones = [...acumulado.values()]
    .map((e) => ({ ...e, kwh: r2(e.kwh), importe: r2(e.importe), limite: e.limite === null ? null : Math.round(e.limite) }));
  const energia = escalones.reduce((s, e) => s + e.importe, 0);
  const iva = energia * IVA;
  const ultimo = [...escalones].reverse().find((e) => e.kwh > 0);
  return {
    tarifa, kwh: r2(totalKwh), kwhCobrado: r2(kwhCobrado), escalones,
    escalonActual: ultimo ? ultimo.nombre : escalones[0]?.nombre,
    produccion: costoProduccion(kwhCobrado, mesesEquivalentes, energia),
    energia: r2(energia), iva: r2(iva), total: r2(energia + iva),
  };
}

// Fecha → "YYYY-MM-DD" (hora local)
const fechaISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function sumarMeses(d, n) {
  const r = new Date(d.getFullYear(), d.getMonth() + n, 1);
  r.setDate(Math.min(d.getDate(), diasDelMes(r.getFullYear(), r.getMonth() + 1)));
  return r;
}

/*
 * Periodo bimestral en el que cae "hoy", a partir de la fecha de inicio de
 * cualquier periodo anterior (la que trae el recibo). Sin esa fecha se usa el
 * bimestre de calendario (ene-feb, mar-abr, ...).
 * Devuelve { inicio, fin } (fin exclusivo) y los días que lleva y le faltan.
 */
function periodoBimestral(inicioPeriodo, hoy = new Date()) {
  let inicio;
  if (inicioPeriodo) {
    const [a, m, d] = String(inicioPeriodo).slice(0, 10).split('-').map(Number);
    inicio = new Date(a, m - 1, d);
    while (sumarMeses(inicio, 2) <= hoy) inicio = sumarMeses(inicio, 2);
    while (inicio > hoy) inicio = sumarMeses(inicio, -2);
  } else {
    inicio = new Date(hoy.getFullYear(), hoy.getMonth() - (hoy.getMonth() % 2), 1);
  }
  const fin = sumarMeses(inicio, 2);
  const dia = 24 * 3600 * 1000;
  const total = Math.round((fin - inicio) / dia);
  const transcurridos = Math.min(total, Math.max(0, (hoy - inicio) / dia));
  return { inicio: fechaISO(inicio), fin: fechaISO(fin), diasTotales: total, diasTranscurridos: r2(transcurridos), diasRestantes: r2(total - transcurridos) };
}

// Días de cada mes calendario que caen en [inicio, fin).
function mesesDelPeriodo(inicio, fin) {
  const [a1, m1, d1] = inicio.split('-').map(Number);
  const [a2, m2, d2] = fin.split('-').map(Number);
  const desde = new Date(a1, m1 - 1, d1), hasta = new Date(a2, m2 - 1, d2);
  const meses = [];
  for (let c = new Date(desde); c < hasta;) {
    const sig = new Date(c.getFullYear(), c.getMonth() + 1, 1);
    const tope = sig < hasta ? sig : hasta;
    meses.push({ anio: c.getFullYear(), mes: c.getMonth() + 1, dias: Math.round((tope - c) / 86400000) });
    c = tope;
  }
  return meses;
}

// Tabla de la tarifa para mostrarla en la app.
function describirTarifa(tarifa, mesInicioVerano = 5) {
  const t = TARIFAS[tarifa] || TARIFAS['1F'];
  const fila = (verano) => escalonesDelMes(tarifa, verano).map((e) => ({ nombre: e.nombre, limiteMensual: e.limite, limiteBimestral: e.limite === null ? null : e.limite * 2, precio: e.precio }));
  return {
    tarifa, limiteDACMensual: t.dac, sinVerano: !!t.sinVerano, mesInicioVerano,
    verano: t.sinVerano ? null : fila(true), fueraVerano: fila(false),
    dac: PRECIOS.dac, iva: IVA, minimoMensualKwh: MINIMO_MENSUAL_KWH,
  };
}

module.exports = {
  CODIGOS, PRECIOS, IVA, esVerano, limiteDAC, escalonesDelMes, calcularRecibo,
  periodoBimestral, mesesDelPeriodo, describirTarifa, fechaISO, sumarMeses,
};
