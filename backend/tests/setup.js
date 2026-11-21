// Variables mínimas para las pruebas (no se usa ninguna base de datos real).
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-pruebas-con-mas-de-32-caracteres-123';
process.env.DEVICE_SECRET = process.env.DEVICE_SECRET || 'secreto-de-sensores-con-mas-de-32-caracteres-456';
process.env.EMAIL_USER = '';

// Base de datos falsa: cada prueba define qué responde.
const db = require('../src/config/db');
const llamadas = [];
let respuestas = [];
db.query = async (sql, params) => {
  llamadas.push({ sql, params });
  const r = respuestas.shift();
  if (r instanceof Error) throw r;
  return r === undefined ? [] : r;
};
db.transaction = async (fn) => fn(db.query);

module.exports = {
  db,
  llamadas,
  responder(...rs) { respuestas = rs; llamadas.length = 0; },
};
