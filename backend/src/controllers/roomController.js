const db = require('../config/db');
const own = require('../services/ownership');
const { ok, badRequest, conflict } = require('../utils/http');
const { requerido, opcional } = require('../utils/validar');

// GET /room/building/:id
async function listarPorEdificio(req, res) {
  await own.edificio(req.user.owner, req.params.id);
  const rows = await db.query('SELECT * FROM SALAS WHERE codigoEdificio = ? ORDER BY nombreSala', [req.params.id]);
  ok(res, rows, rows.length ? 'Salas recuperadas' : 'Este edificio aún no tiene salas registradas');
}

// POST /room
async function crear(req, res) {
  const errores = [];
  const codigoSala = requerido(errores, req.body.codigoSala, 'El código de la sala', 10);
  const codigoEdificio = requerido(errores, req.body.codigoEdificio, 'El código del edificio', 10);
  const nombreSala = opcional(errores, req.body.nombreSala, 'El nombre de la sala', 60);
  if (errores.length) throw badRequest('Datos de la sala inválidos', errores);

  await own.edificio(req.user.owner, codigoEdificio);
  const existe = await db.query('SELECT 1 FROM SALAS WHERE codigoSala = ?', [codigoSala]);
  if (existe.length) throw conflict('Este código de sala ya está registrado');
  await db.query('INSERT INTO SALAS SET ?', [{ codigoSala, codigoEdificio, nombreSala }]);
  ok(res, { codigoSala, codigoEdificio, nombreSala }, 'Sala agregada correctamente', 201);
}

// DELETE /room/:id
async function eliminar(req, res) {
  await own.sala(req.user.owner, req.params.id);
  await db.query('DELETE FROM SALAS WHERE codigoSala = ?', [req.params.id]);
  ok(res, null, 'Sala y sus dependencias eliminadas con éxito');
}

module.exports = { listarPorEdificio, crear, eliminar };
