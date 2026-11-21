const db = require('../config/db');
const own = require('../services/ownership');
const { ok, badRequest } = require('../utils/http');

// Ciclo de vida permitido: ACTIVA → ATENDIDA → CERRADA (o ACTIVA → CERRADA).
const TRANSICIONES = { ACTIVA: ['ATENDIDA', 'CERRADA'], ATENDIDA: ['CERRADA'], CERRADA: [] };

function transicionValida(actual, nuevo) {
  return (TRANSICIONES[actual] || []).includes(nuevo);
}

// GET /alarm/user/:id
async function obtenerAlarmasPorUsuario(req, res) {
  const rows = await db.query(`
    SELECT a.codigoAlarma, a.codigoSensor, a.tipoAlarma, a.nivel, a.estado, a.fechaHora, a.detalle,
           e.nombreEdificio, s.nombreSala
    FROM ALARMAS a
    JOIN EDIFICIOS e ON a.codigoEdificio = e.codigoEdificio
    JOIN SALAS s ON a.codigoSala = s.codigoSala
    WHERE e.idUsuario = ?
    ORDER BY (a.estado = 'ACTIVA') DESC, a.fechaHora DESC
    LIMIT 500`, [req.user.owner]);
  ok(res, rows, rows.length ? 'Alarmas obtenidas' : 'No hay notificaciones pendientes');
}

// PATCH /alarm/:id/estado
async function actualizarEstado(req, res) {
  const nuevo = String(req.body.estado || '').toUpperCase();
  if (!TRANSICIONES[nuevo]) throw badRequest('Estado no válido');
  const a = await own.alarma(req.user.owner, req.params.id);
  if (a.estado === nuevo) return ok(res, { estado: nuevo }, 'La alarma ya tenía ese estado');
  if (!transicionValida(a.estado, nuevo)) throw badRequest(`No se puede cambiar una alarma ${a.estado} a ${nuevo}`);
  // Al dejar de estar ACTIVA se libera claveActiva para permitir una alarma nueva.
  await db.query('UPDATE ALARMAS SET estado = ?, claveActiva = NULL WHERE codigoAlarma = ?', [nuevo, req.params.id]);
  ok(res, { estado: nuevo }, 'Estado de la alarma actualizado correctamente');
}

module.exports = { obtenerAlarmasPorUsuario, actualizarEstado, transicionValida };
