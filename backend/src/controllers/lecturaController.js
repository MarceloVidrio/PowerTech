const db = require('../config/db');
const own = require('../services/ownership');
const { ok, badRequest, unauthorized, conflict, notFound } = require('../utils/http');
const { verifySensorToken } = require('../utils/security');
const { FECHA_RE } = require('../utils/validar');
const { procesarLectura } = require('../services/alarmService');
const { publicar } = require('../services/eventBus');

// POST /lecturas — lo llama el nodo IoT con el encabezado X-Sensor-Token.
async function crear(req, res) {
  const { codigoSensor, fechaHora, valor, detalle } = req.body;
  const errores = [];
  if (!codigoSensor || !String(codigoSensor).trim()) errores.push('El código del sensor es obligatorio');
  if (!fechaHora || !FECHA_RE.test(String(fechaHora))) errores.push('La fecha y hora deben tener el formato YYYY-MM-DD HH:MM:SS');
  const v = Number(valor);
  if (valor === undefined || valor === null || valor === '' || !Number.isFinite(v)) errores.push('El valor de la lectura debe ser un número');
  else if (v < 0) errores.push('El valor de la lectura no puede ser negativo');
  if (detalle && String(detalle).length > 200) errores.push('El detalle no debe superar 200 caracteres');
  if (errores.length) throw badRequest('Datos incompletos', errores);

  const token = req.get('X-Sensor-Token') || req.body.token;
  if (!verifySensorToken(codigoSensor, token)) throw unauthorized('Token del sensor no válido');

  const rows = await db.query(`
    SELECT s.codigoSensor, s.activo, s.umbralAlto, s.umbralBajo, s.unidadMedida, s.idUsuario, s.codigoDispositivo,
           d.codigoSala, d.controlUrl, d.autoApagado, sa.codigoEdificio, e.horarioEntrada, e.horarioSalida
    FROM SENSORES s
    LEFT JOIN DISPOSITIVOS d ON d.codigoDispositivo = s.codigoDispositivo
    LEFT JOIN SALAS sa ON sa.codigoSala = d.codigoSala
    LEFT JOIN EDIFICIOS e ON e.codigoEdificio = sa.codigoEdificio
    WHERE s.codigoSensor = ?`, [codigoSensor]);
  const ctx = rows[0];
  if (!ctx) throw notFound('Sensor no encontrado');
  if (!ctx.activo) throw conflict('El sensor está desactivado; la lectura no se registró');

  const fecha = String(fechaHora).replace('T', ' ');
  try {
    await db.query('INSERT INTO LECTURAS (codigoSensor, fechaHora, valor, detalle) VALUES (?, ?, ?, ?)',
      [codigoSensor, fecha, v, detalle || null]);
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') throw conflict('Lectura duplicada: ya existe una lectura de este sensor en ese instante');
    throw e;
  }

  const alarmas = await procesarLectura(ctx, { fechaHora: fecha, valor: v });
  publicar(ctx.idUsuario, 'lectura', { codigoSensor, fechaHora: fecha, valor: v });
  ok(res, { alarmas: alarmas.map((a) => ({ codigoAlarma: a.codigoAlarma, tipoAlarma: a.tipoAlarma, nivel: a.nivel })) },
    'Lectura registrada correctamente', 201);
}

// GET /lecturas/sala/:codigoSala
async function obtenerPorSala(req, res) {
  await own.sala(req.user.owner, req.params.codigoSala);
  const rows = await db.query(`
    SELECT l.codigoSensor, l.fechaHora, l.valor, l.detalle, s.umbralAlto, s.unidadMedida
    FROM LECTURAS l
    JOIN SENSORES s ON l.codigoSensor = s.codigoSensor
    JOIN DISPOSITIVOS d ON s.codigoDispositivo = d.codigoDispositivo
    WHERE d.codigoSala = ? AND l.fechaHora >= NOW() - INTERVAL 30 DAY
    ORDER BY l.fechaHora ASC`, [req.params.codigoSala]);
  ok(res, rows, 'Lecturas obtenidas correctamente');
}

module.exports = { crear, obtenerPorSala };
