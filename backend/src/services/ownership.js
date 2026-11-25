// Busca la información del hogar de la cuenta que hace la petición.
// owner = el titular (para un familiar, el titular al que pertenece).
// Si algo no es de esa cuenta responde 404 (no se revela que existe).
const db = require('../config/db');
const { notFound } = require('../utils/http');

async function unico(sql, params, mensaje) {
  const rows = await db.query(sql, params);
  if (!rows.length) throw notFound(mensaje);
  return rows[0];
}

// Hogar + medidor (codigoMedidor y medidorActivo pueden ser NULL).
const hogar = (owner) => unico(
  `SELECT h.*, m.codigoMedidor, m.nombre AS nombreMedidor, m.modelo AS modeloMedidor, m.activo AS medidorActivo
   FROM HOGARES h LEFT JOIN MEDIDORES m ON m.idHogar = h.idHogar
   WHERE h.idUsuario = ?`, [owner], 'Aún no se ha configurado el hogar');

const aparato = (owner, id) => unico(
  `SELECT a.* FROM APARATOS a JOIN HOGARES h ON h.idHogar = a.idHogar
   WHERE a.idAparato = ? AND h.idUsuario = ?`, [Number(id), owner], 'Aparato no encontrado');

const alarma = (owner, codigo) => unico(
  `SELECT a.* FROM ALARMAS a JOIN HOGARES h ON h.idHogar = a.idHogar
   WHERE a.codigoAlarma = ? AND h.idUsuario = ?`, [codigo, owner], 'Aviso no encontrado');

module.exports = { hogar, aparato, alarma };
