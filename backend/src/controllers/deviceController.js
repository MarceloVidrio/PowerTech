const db = require('../config/db');
const own = require('../services/ownership');
const { ok, badRequest, conflict, HttpError } = require('../utils/http');
const { requerido, opcional } = require('../utils/validar');
const { enviarComando, validarUrl } = require('../services/controlService');

const TIPOS = ['C', 'A']; // C = computadora, A = aire acondicionado

function agrupar(rows, extra = () => ({})) {
  const mapa = {};
  for (const row of rows) {
    if (!mapa[row.codigoDispositivo]) {
      mapa[row.codigoDispositivo] = {
        codigoDispositivo: row.codigoDispositivo,
        codigoSala: row.codigoSala,
        nombre: row.nombreDispositivo,
        marca: row.marca,
        tipo: row.tipo,
        controlUrl: row.controlUrl,
        autoApagado: !!row.autoApagado,
        ...extra(row),
        sensor: null,
      };
    }
    if (row.codigoSensor) {
      mapa[row.codigoDispositivo].sensor = {
        codigoSensor: row.codigoSensor,
        nombreSensor: row.nombreSensor,
        unidadMedida: row.unidadMedida,
        activo: row.activo,
        ultimaLectura: row.valor !== null && row.valor !== undefined ? { valor: row.valor, fechaHora: row.fechaHora } : null,
      };
    }
  }
  return Object.values(mapa);
}

// GET /device/room/:id
async function listarPorSala(req, res) {
  await own.sala(req.user.owner, req.params.id);
  const rows = await db.query(`
    SELECT d.codigoDispositivo, d.codigoSala, d.nombre AS nombreDispositivo, d.marca, d.tipo, d.controlUrl, d.autoApagado,
           s.codigoSensor, s.nombreSensor, s.unidadMedida, s.activo, l.fechaHora, l.valor
    FROM DISPOSITIVOS d
    LEFT JOIN SENSORES s ON d.codigoDispositivo = s.codigoDispositivo
    LEFT JOIN (SELECT codigoSensor, MAX(fechaHora) AS max_fecha FROM LECTURAS GROUP BY codigoSensor) u ON s.codigoSensor = u.codigoSensor
    LEFT JOIN LECTURAS l ON u.codigoSensor = l.codigoSensor AND u.max_fecha = l.fechaHora
    WHERE d.codigoSala = ?
    ORDER BY d.nombre`, [req.params.id]);
  const data = agrupar(rows);
  ok(res, data, data.length ? 'Dispositivos recuperados' : 'No hay dispositivos');
}

// GET /device/user/:id
async function listarPorUsuario(req, res) {
  const rows = await db.query(`
    SELECT d.codigoDispositivo, d.codigoSala, d.nombre AS nombreDispositivo, d.marca, d.tipo, d.controlUrl, d.autoApagado,
           sa.nombreSala, e.nombreEdificio, s.codigoSensor, s.nombreSensor, s.unidadMedida, s.activo
    FROM DISPOSITIVOS d
    JOIN SALAS sa ON d.codigoSala = sa.codigoSala
    JOIN EDIFICIOS e ON sa.codigoEdificio = e.codigoEdificio
    LEFT JOIN SENSORES s ON d.codigoDispositivo = s.codigoDispositivo
    WHERE e.idUsuario = ?
    ORDER BY e.nombreEdificio, sa.nombreSala, d.nombre`, [req.user.owner]);
  const data = agrupar(rows, (r) => ({ nombreSala: r.nombreSala, nombreEdificio: r.nombreEdificio }));
  ok(res, data, data.length ? 'Recuperados' : 'Sin dispositivos');
}

function datosControl(body, errores) {
  const controlUrl = opcional(errores, body.controlUrl, 'La URL del relevador', 255);
  if (controlUrl && !validarUrl(controlUrl)) errores.push('La URL del relevador debe iniciar con http:// o https://');
  return { controlUrl, autoApagado: body.autoApagado ? 1 : 0 };
}

// POST /device
async function crear(req, res) {
  const errores = [];
  const codigoDispositivo = requerido(errores, req.body.codigoDispositivo, 'El código del dispositivo', 10);
  const codigoSala = requerido(errores, req.body.codigoSala, 'El código de la sala', 10);
  const nombre = requerido(errores, req.body.nombre, 'El nombre', 100);
  const marca = opcional(errores, req.body.marca, 'La marca', 60) || '';
  const tipo = String(req.body.tipo || 'C').toUpperCase();
  if (!TIPOS.includes(tipo)) errores.push('El tipo debe ser C (computadora) o A (aire acondicionado)');
  const control = datosControl(req.body, errores);
  if (errores.length) throw badRequest('Datos inválidos', errores);

  await own.sala(req.user.owner, codigoSala);
  const codigoSensor = req.body.codigoSensor ? String(req.body.codigoSensor) : null;
  if (codigoSensor) {
    const s = await own.sensor(req.user.owner, codigoSensor);
    if (s.codigoDispositivo) throw conflict('El sensor ya está asignado a otro dispositivo');
  }
  const existe = await db.query('SELECT 1 FROM DISPOSITIVOS WHERE codigoDispositivo = ?', [codigoDispositivo]);
  if (existe.length) throw conflict('Este código ya existe');

  await db.transaction(async (q) => {
    await q('INSERT INTO DISPOSITIVOS SET ?', [{ codigoDispositivo, codigoSala, nombre, marca, tipo, ...control }]);
    if (codigoSensor) await q('UPDATE SENSORES SET codigoDispositivo = ? WHERE codigoSensor = ?', [codigoDispositivo, codigoSensor]);
  });
  ok(res, { codigoDispositivo }, codigoSensor ? 'Dispositivo registrado y sensor vinculado' : 'Dispositivo registrado correctamente sin sensor', 201);
}

// PATCH /device/:id/sensor — relación 1 a 1 entre dispositivo y sensor.
async function asignarSensor(req, res) {
  const { id } = req.params;
  await own.dispositivo(req.user.owner, id);
  const codigoSensor = req.body.codigoSensor ? String(req.body.codigoSensor) : null;
  if (codigoSensor) {
    const s = await own.sensor(req.user.owner, codigoSensor);
    if (s.codigoDispositivo && s.codigoDispositivo !== id) throw conflict('El sensor ya está asignado a otro dispositivo');
  }
  await db.transaction(async (q) => {
    await q('UPDATE SENSORES SET codigoDispositivo = NULL WHERE codigoDispositivo = ?', [id]);
    if (codigoSensor) await q('UPDATE SENSORES SET codigoDispositivo = ? WHERE codigoSensor = ?', [id, codigoSensor]);
  });
  ok(res, null, codigoSensor ? 'Sensor asignado correctamente' : 'Sensor desvinculado del dispositivo');
}

// PATCH /device/:id/control — URL del relevador y apagado automático fuera de horario.
async function configurarControl(req, res) {
  await own.dispositivo(req.user.owner, req.params.id);
  const errores = [];
  const control = datosControl(req.body, errores);
  if (errores.length) throw badRequest('Datos inválidos', errores);
  await db.query('UPDATE DISPOSITIVOS SET ? WHERE codigoDispositivo = ?', [control, req.params.id]);
  ok(res, control, 'Control del dispositivo actualizado');
}

// POST /device/:id/power  { estado: "ON" | "OFF" }
async function encenderApagar(req, res) {
  const d = await own.dispositivo(req.user.owner, req.params.id);
  if (!d.controlUrl) throw badRequest('Este dispositivo no tiene un relevador configurado');
  const estado = String(req.body.estado || '').toUpperCase();
  if (!['ON', 'OFF'].includes(estado)) throw badRequest('El estado debe ser ON u OFF');
  try {
    await enviarComando(d.controlUrl, estado);
  } catch (e) {
    console.error(`Relevador de ${d.codigoDispositivo}:`, e.message);
    throw new HttpError(502, 'No se pudo comunicar con el relevador del dispositivo');
  }
  ok(res, { estado }, estado === 'ON' ? 'Dispositivo encendido' : 'Dispositivo apagado');
}

// DELETE /device/:id — el sensor queda libre (ON DELETE SET NULL) y conserva su historial.
async function eliminar(req, res) {
  await own.dispositivo(req.user.owner, req.params.id);
  await db.query('DELETE FROM DISPOSITIVOS WHERE codigoDispositivo = ?', [req.params.id]);
  ok(res, null, 'Dispositivo eliminado');
}

// GET /device/room/:id/available-sensors — sensores libres de la misma cuenta.
async function listarSensoresLibres(req, res) {
  await own.sala(req.user.owner, req.params.id);
  const rows = await db.query(
    'SELECT codigoSensor, nombreSensor FROM SENSORES WHERE codigoDispositivo IS NULL AND idUsuario = ? ORDER BY nombreSensor', [req.user.owner]);
  ok(res, rows);
}

module.exports = { listarPorSala, listarPorUsuario, crear, asignarSensor, configurarControl, encenderApagar, eliminar, listarSensoresLibres };
