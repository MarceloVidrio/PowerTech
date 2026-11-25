// Crea avisos respetando "una alarma ACTIVA por hogar y tipo" (la base de
// datos lo garantiza con un índice único) y apaga aparatos si corresponde.
const db = require('../config/db');
const { evaluarLectura, evaluarPeriodo } = require('./alarmRules');
const { notificarAlarma } = require('./notificationService');
const { resumenPeriodo } = require('./consumoService');
const { idAleatorio } = require('../utils/security');

async function crearAlarmas(ctx, candidatas, fechaHora) {
  const creadas = [];
  for (const c of candidatas) {
    const alarma = {
      codigoAlarma: idAleatorio('AL-', 8),
      idHogar: ctx.idHogar,
      tipoAlarma: c.tipo,
      nivel: c.nivel,
      estado: 'ACTIVA',
      fechaHora,
      detalle: c.detalle,
    };
    try {
      await db.query('INSERT INTO ALARMAS SET ?', [{ ...alarma, claveActiva: `${ctx.idHogar}|${c.tipo}` }]);
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') continue; // ya hay un aviso activo de ese tipo
      throw e;
    }
    creadas.push(alarma);
    notificarAlarma(ctx.idUsuario, { ...alarma, nombreHogar: ctx.nombre }).catch(() => {});
  }
  return creadas;
}

// El consumo del periodo se revisa como máximo cada 30 minutos por hogar.
const ultimaRevision = new Map();
const REVISION_MS = 30 * 60 * 1000;

// ctx: datos del hogar y del medidor (ver lecturaController)
async function procesarLectura(ctx, lectura, ahora = Date.now()) {
  const candidatas = evaluarLectura({ ...ctx, valor: lectura.valor, fechaHora: lectura.fechaHora });
  const creadas = await crearAlarmas(ctx, candidatas, lectura.fechaHora);

  if (ahora - (ultimaRevision.get(ctx.idHogar) || 0) >= REVISION_MS) {
    ultimaRevision.set(ctx.idHogar, ahora);
    try {
      const r = await resumenPeriodo(ctx, ctx.codigoMedidor);
      const periodo = evaluarPeriodo({
        proyeccionKwh: r.proyeccion, metaBimestralKwh: ctx.metaBimestralKwh,
        kwhMensualEstimado: r.dac.kwhMensualEstimado, limiteDAC: r.dac.limiteMensual, confiable: r.confiable,
      });
      creadas.push(...await crearAlarmas(ctx, periodo, lectura.fechaHora));
    } catch (e) {
      console.error('No se pudo revisar el consumo del periodo:', e.message);
    }
  }
  return creadas;
}

module.exports = { procesarLectura, crearAlarmas, _ultimaRevision: ultimaRevision };
