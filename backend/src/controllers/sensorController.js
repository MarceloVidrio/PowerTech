const db = require('../config/db');
const own = require('../services/ownership');
const { ok, badRequest, conflict } = require('../utils/http');
const { requerido, opcional, numeroOpcional } = require('../utils/validar');
const { sensorToken } = require('../utils/security');

function validarUmbrales(errores, body) {
  const umbralBajo = numeroOpcional(errores, body.umbralBajo, 'El umbral bajo');
  const umbralAlto = numeroOpcional(errores, body.umbralAlto, 'El umbral alto');
  if (umbralBajo !== null && umbralBajo < 0) errores.push('El umbral bajo no puede ser negativo');
  if (umbralBajo !== null && umbralAlto !== null && umbralBajo >= umbralAlto) errores.push('El umbral bajo debe ser menor al umbral alto');
  return { umbralBajo, umbralAlto };
}

// GET /sensor/device/:id
async function listarPorDispositivo(req, res) {
  await own.dispositivo(req.user.owner, req.params.id);
  const rows = await db.query('SELECT * FROM SENSORES WHERE codigoDispositivo = ?', [req.params.id]);
  ok(res, rows, rows.length ? 'Sensores recuperados' : 'Sin sensores');
}

// GET /sensor/user/:id — incluye los sensores libres (sin dispositivo).
async function listarPorUsuario(req, res) {
  const rows = await db.query(`
    SELECT s.*, d.nombre AS nombreDispositivo, sa.nombreSala, e.nombreEdificio
    FROM SENSORES s
    LEFT JOIN DISPOSITIVOS d ON s.codigoDispositivo = d.codigoDispositivo
    LEFT JOIN SALAS sa ON d.codigoSala = sa.codigoSala
    LEFT JOIN EDIFICIOS e ON sa.codigoEdificio = e.codigoEdificio
    WHERE s.idUsuario = ?
    ORDER BY s.nombreSensor`, [req.user.owner]);
  ok(res, rows, rows.length ? 'Sensores recuperados' : 'Sin sensores');
}

// POST /sensor
async function crear(req, res) {
  const errores = [];
  const codigoSensor = requerido(errores, req.body.codigoSensor, 'El código del sensor', 10);
  const nombreSensor = requerido(errores, req.body.nombreSensor, 'El nombre del sensor', 80);
  const tipoSensor = requerido(errores, req.body.tipoSensor, 'El tipo de sensor', 40);
  const unidadMedida = opcional(errores, req.body.unidadMedida, 'La unidad de medida', 20);
  const codigoDispositivo = opcional(errores, req.body.codigoDispositivo, 'El código del dispositivo', 10);
  const umbrales = validarUmbrales(errores, req.body);
  if (errores.length) throw badRequest('Datos inválidos', errores);

  if (codigoDispositivo) {
    await own.dispositivo(req.user.owner, codigoDispositivo);
    const ocupado = await db.query('SELECT 1 FROM SENSORES WHERE codigoDispositivo = ?', [codigoDispositivo]);
    if (ocupado.length) throw conflict('El dispositivo ya tiene un sensor asignado');
  }
  const existe = await db.query('SELECT 1 FROM SENSORES WHERE codigoSensor = ?', [codigoSensor]);
  if (existe.length) throw conflict('Código ya registrado');

  await db.query('INSERT INTO SENSORES SET ?', [{
    codigoSensor, nombreSensor, tipoSensor, unidadMedida, codigoDispositivo, ...umbrales,
    activo: req.body.activo === undefined ? 1 : (req.body.activo ? 1 : 0), idUsuario: req.user.owner,
  }]);
  ok(res, { codigoSensor }, 'Sensor agregado correctamente', 201);
}

// PATCH /sensor/:id/umbrales
async function actualizarUmbrales(req, res) {
  await own.sensor(req.user.owner, req.params.id);
  const errores = [];
  const umbrales = validarUmbrales(errores, req.body);
  if (errores.length) throw badRequest('Datos inválidos', errores);
  await db.query('UPDATE SENSORES SET ? WHERE codigoSensor = ?', [umbrales, req.params.id]);
  ok(res, umbrales, 'Umbrales actualizados');
}

// DELETE /sensor/:id — sus lecturas y alarmas se eliminan en cascada.
async function eliminar(req, res) {
  await own.sensor(req.user.owner, req.params.id);
  await db.query('DELETE FROM SENSORES WHERE codigoSensor = ?', [req.params.id]);
  ok(res, null, 'Sensor eliminado con éxito');
}

// PATCH /sensor/:id/estado
async function actualizarEstado(req, res) {
  await own.sensor(req.user.owner, req.params.id);
  const activo = req.body.activo === true || req.body.activo === 1 || req.body.activo === '1' || req.body.activo === 'true';
  await db.query('UPDATE SENSORES SET activo = ? WHERE codigoSensor = ?', [activo ? 1 : 0, req.params.id]);
  ok(res, { activo }, 'Estado actualizado correctamente');
}

// GET /sensor/:id/readings — últimas 15 lecturas en orden cronológico.
async function obtenerLecturas(req, res) {
  await own.sensor(req.user.owner, req.params.id);
  const rows = await db.query('SELECT fechaHora, valor FROM LECTURAS WHERE codigoSensor = ? ORDER BY fechaHora DESC LIMIT 15', [req.params.id]);
  ok(res, rows.reverse());
}

// GET /sensor/:id/token — token que se configura en el nodo IoT (solo administrador).
async function obtenerToken(req, res) {
  await own.sensor(req.user.owner, req.params.id);
  ok(res, { codigoSensor: req.params.id, token: sensorToken(req.params.id) },
    'Configura este token en el nodo del sensor (encabezado X-Sensor-Token)');
}

module.exports = { listarPorDispositivo, listarPorUsuario, crear, actualizarUmbrales, eliminar, actualizarEstado, obtenerLecturas, obtenerToken };
