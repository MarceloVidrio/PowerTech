// Verifica que cada recurso pertenezca a la cuenta del usuario autenticado.
// Si no le pertenece responde 404 (no se revela que el recurso existe).
const db = require('../config/db');
const { notFound } = require('../utils/http');

async function unico(sql, params, mensaje) {
  const rows = await db.query(sql, params);
  if (!rows.length) throw notFound(mensaje);
  return rows[0];
}

const edificio = (owner, codigo) => unico(
  'SELECT * FROM EDIFICIOS WHERE codigoEdificio = ? AND idUsuario = ?', [codigo, owner], 'Edificio no encontrado');

const sala = (owner, codigo) => unico(
  `SELECT s.*, e.idUsuario, e.horarioEntrada, e.horarioSalida FROM SALAS s
   JOIN EDIFICIOS e ON e.codigoEdificio = s.codigoEdificio
   WHERE s.codigoSala = ? AND e.idUsuario = ?`, [codigo, owner], 'Sala no encontrada');

const dispositivo = (owner, codigo) => unico(
  `SELECT d.*, s.codigoEdificio FROM DISPOSITIVOS d
   JOIN SALAS s ON s.codigoSala = d.codigoSala
   JOIN EDIFICIOS e ON e.codigoEdificio = s.codigoEdificio
   WHERE d.codigoDispositivo = ? AND e.idUsuario = ?`, [codigo, owner], 'Dispositivo no encontrado');

const sensor = (owner, codigo) => unico(
  'SELECT * FROM SENSORES WHERE codigoSensor = ? AND idUsuario = ?', [codigo, owner], 'Sensor no encontrado');

const alarma = (owner, codigo) => unico(
  `SELECT a.* FROM ALARMAS a JOIN EDIFICIOS e ON e.codigoEdificio = a.codigoEdificio
   WHERE a.codigoAlarma = ? AND e.idUsuario = ?`, [codigo, owner], 'Alarma no encontrada');

module.exports = { edificio, sala, dispositivo, sensor, alarma };
