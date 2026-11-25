const db = require('../config/db');
const own = require('../services/ownership');
const { ok, badRequest, unauthorized, conflict, notFound } = require('../utils/http');
const { verifySensorToken } = require('../utils/security');
const { FECHA_RE } = require('../utils/validar');
const { procesarLectura } = require('../services/alarmService');
const { publicar } = require('../services/eventBus');

// POST /lecturas — lo llama el sensor de la pastilla principal con el encabezado X-Sensor-Token.
// Cuerpo: { codigoMedidor, fechaHora: "YYYY-MM-DD HH:MM:SS", valor (W) }
// (también se acepta "codigoSensor" en lugar de "codigoMedidor").
async function crear(req, res) {
  const { fechaHora, valor } = req.body;
  const codigoMedidor = req.body.codigoMedidor || req.body.codigoSensor;
  const errores = [];
  if (!codigoMedidor || !String(codigoMedidor).trim()) errores.push('El código del sensor es obligatorio');
  if (!fechaHora || !FECHA_RE.test(String(fechaHora))) errores.push('La fecha y hora deben tener el formato YYYY-MM-DD HH:MM:SS');
  const v = Number(valor);
  if (valor === undefined || valor === null || valor === '' || !Number.isFinite(v)) errores.push('El valor de la lectura debe ser un número');
  else if (v < 0) errores.push('El valor de la lectura no puede ser negativo');
  if (errores.length) throw badRequest('Datos incompletos', errores);

  const token = req.get('X-Sensor-Token') || req.body.token;
  if (!verifySensorToken(codigoMedidor, token)) throw unauthorized('Token del sensor no válido');

  const rows = await db.query(`
    SELECT m.codigoMedidor, m.activo, h.*
    FROM MEDIDORES m JOIN HOGARES h ON h.idHogar = m.idHogar
    WHERE m.codigoMedidor = ?`, [codigoMedidor]);
  const ctx = rows[0];
  if (!ctx) throw notFound('Sensor no encontrado');
  if (!ctx.activo) throw conflict('El sensor está pausado; la lectura no se registró');

  const fecha = String(fechaHora).replace('T', ' ');
  try {
    await db.query('INSERT INTO LECTURAS (codigoMedidor, fechaHora, valor) VALUES (?, ?, ?)', [codigoMedidor, fecha, v]);
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') throw conflict('Lectura duplicada: ya existe una lectura de este sensor en ese instante');
    throw e;
  }

  const alarmas = await procesarLectura(ctx, { fechaHora: fecha, valor: v });
  publicar(ctx.idUsuario, 'lectura', { codigoMedidor, fechaHora: fecha, valor: v });
  ok(res, { alarmas: alarmas.map((a) => ({ codigoAlarma: a.codigoAlarma, tipoAlarma: a.tipoAlarma, nivel: a.nivel })) },
    'Lectura registrada correctamente', 201);
}

// GET /lecturas/recientes?horas=24 — potencia promedio cada 5 minutos para la gráfica en vivo.
async function recientes(req, res) {
  const h = await own.hogar(req.user.owner);
  if (!h.codigoMedidor) return ok(res, []);
  const horas = Math.min(Math.max(Number(req.query.horas) || 24, 1), 72);
  const rows = await db.query(`
    SELECT FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP(fechaHora) / 300) * 300) AS fechaHora,
           ROUND(AVG(valor), 1) AS valor, ROUND(MAX(valor), 1) AS maximo
    FROM LECTURAS
    WHERE codigoMedidor = ? AND fechaHora >= NOW() - INTERVAL ? HOUR
    GROUP BY FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP(fechaHora) / 300) * 300)
    ORDER BY 1`, [h.codigoMedidor, horas]);
  ok(res, rows.map((r) => ({ fechaHora: r.fechaHora, valor: Number(r.valor), maximo: Number(r.maximo) })));
}

module.exports = { crear, recientes };
