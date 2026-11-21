const db = require('../config/db');
const own = require('../services/ownership');
const { ok, badRequest, conflict } = require('../utils/http');
const { requerido, opcional, HORA_RE } = require('../utils/validar');

function validar(body) {
  const errores = [];
  const codigoEdificio = requerido(errores, body.codigoEdificio, 'El código del edificio', 10);
  const nombreEdificio = requerido(errores, body.nombreEdificio, 'El nombre del edificio', 120);
  const horarioEntrada = requerido(errores, body.horarioEntrada, 'El horario de entrada');
  const horarioSalida = requerido(errores, body.horarioSalida, 'El horario de salida');
  if (horarioEntrada && !HORA_RE.test(horarioEntrada)) errores.push('El horario de entrada no es válido');
  if (horarioSalida && !HORA_RE.test(horarioSalida)) errores.push('El horario de salida no es válido');
  if (horarioEntrada && horarioSalida && horarioEntrada >= horarioSalida) errores.push('El horario de entrada debe ser menor al de salida');
  const codigoTarifa = opcional(errores, body.codigoTarifa, 'La tarifa', 10);
  if (errores.length) throw badRequest('Datos del edificio inválidos', errores);
  return { codigoEdificio, nombreEdificio, horarioEntrada, horarioSalida, codigoTarifa };
}

// GET /building/user/:id
async function listarPorUsuario(req, res) {
  const rows = await db.query('SELECT * FROM EDIFICIOS WHERE idUsuario = ? ORDER BY nombreEdificio', [req.user.owner]);
  ok(res, rows, rows.length ? 'Edificios recuperados' : 'Aún no tienes edificios registrados');
}

// POST /building — el propietario sale de la sesión, nunca del cuerpo.
async function crear(req, res) {
  const datos = validar(req.body);
  const existe = await db.query('SELECT 1 FROM EDIFICIOS WHERE codigoEdificio = ?', [datos.codigoEdificio]);
  if (existe.length) throw conflict('Este código de edificio ya está registrado');
  if (!datos.codigoTarifa) delete datos.codigoTarifa;
  await db.query('INSERT INTO EDIFICIOS SET ?', [{ ...datos, idUsuario: req.user.owner }]);
  ok(res, datos, 'Edificio agregado correctamente', 201);
}

// DELETE /building/:id — salas, dispositivos, alarmas y lecturas se eliminan en cascada.
async function eliminar(req, res) {
  await own.edificio(req.user.owner, req.params.id);
  await db.query('DELETE FROM EDIFICIOS WHERE codigoEdificio = ? AND idUsuario = ?', [req.params.id, req.user.owner]);
  ok(res, null, 'Edificio y sus dependencias eliminados con éxito');
}

module.exports = { listarPorUsuario, crear, eliminar };
