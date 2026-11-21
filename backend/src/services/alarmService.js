// Crea alarmas a partir de una lectura respetando "una alarma ACTIVA por
// sensor y tipo" (la base de datos lo garantiza con un índice único).
const db = require('../config/db');
const { evaluarLectura, TIPOS } = require('./alarmRules');
const { notificarAlarma } = require('./notificationService');
const { enviarComando } = require('./controlService');
const { idAleatorio } = require('../utils/security');

async function procesarLectura(ctx, lectura) {
  // ctx: datos del sensor, dispositivo y edificio (ver lecturaController)
  if (!ctx.codigoDispositivo) return [];
  const candidatas = evaluarLectura({
    valor: lectura.valor,
    fechaHora: lectura.fechaHora,
    umbralAlto: ctx.umbralAlto,
    umbralBajo: ctx.umbralBajo,
    unidad: ctx.unidadMedida || 'W',
    horarioEntrada: ctx.horarioEntrada,
    horarioSalida: ctx.horarioSalida,
  });

  const creadas = [];
  for (const c of candidatas) {
    const alarma = {
      codigoAlarma: idAleatorio('AL-', 8),
      codigoEdificio: ctx.codigoEdificio,
      codigoSala: ctx.codigoSala,
      codigoSensor: ctx.codigoSensor,
      tipoAlarma: c.tipo,
      nivel: c.nivel,
      estado: 'ACTIVA',
      fechaHora: lectura.fechaHora,
      detalle: c.detalle,
    };
    try {
      // claveActiva + índice único: una sola alarma ACTIVA por sensor y tipo.
      await db.query('INSERT INTO ALARMAS SET ?', [{ ...alarma, claveActiva: `${ctx.codigoSensor}|${c.tipo}` }]);
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') continue; // ya hay una alarma activa de ese tipo
      throw e;
    }
    creadas.push(alarma);
    notificarAlarma(ctx.idUsuario, alarma).catch(() => {});

    // Apagado automático: solo si el dispositivo lo tiene habilitado.
    if (c.tipo === TIPOS.FUERA_HORARIO && ctx.autoApagado && ctx.controlUrl) {
      enviarComando(ctx.controlUrl, 'OFF')
        .then(() => db.query('UPDATE ALARMAS SET detalle = CONCAT(detalle, ?) WHERE codigoAlarma = ?',
          [' · Equipo apagado automáticamente', alarma.codigoAlarma]))
        .catch((e) => console.error(`No se pudo apagar ${ctx.codigoDispositivo}:`, e.message));
    }
  }
  return creadas;
}

module.exports = { procesarLectura };
