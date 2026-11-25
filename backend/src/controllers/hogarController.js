// Configuración del hogar y de su sensor de consumo (en la pastilla principal).
const db = require('../config/db');
const own = require('../services/ownership');
const { ok, badRequest, conflict, notFound } = require('../utils/http');
const { opcional, numeroOpcional, HORA_RE } = require('../utils/validar');
const { sensorToken, idAleatorio } = require('../utils/security');
const { CODIGOS } = require('../services/tarifaCFE');
const { apagarPorVacaciones } = require('../services/programador');

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

function publico(h) {
  return {
    idHogar: h.idHogar, nombre: h.nombre, ciudad: h.ciudad, tarifa: h.tarifa, mesInicioVerano: h.mesInicioVerano,
    inicioPeriodo: h.inicioPeriodo ? String(h.inicioPeriodo).slice(0, 10) : null,
    personas: h.personas, metaBimestralKwh: h.metaBimestralKwh,
    horaDormirInicio: String(h.horaDormirInicio).slice(0, 5), horaDormirFin: String(h.horaDormirFin).slice(0, 5),
    consumoBaseW: Number(h.consumoBaseW), consumoNocheW: Number(h.consumoNocheW), umbralAltoW: Number(h.umbralAltoW),
    modoVacaciones: !!h.modoVacaciones,
    medidor: h.codigoMedidor
      ? { codigoMedidor: h.codigoMedidor, nombre: h.nombreMedidor, modelo: h.modeloMedidor, activo: !!h.medidorActivo }
      : null,
  };
}

// GET /hogar — titular y familiares. data = null si aún no está configurado.
async function obtener(req, res) {
  try {
    const h = await own.hogar(req.user.owner);
    const [ult] = h.codigoMedidor
      ? await db.query('SELECT fechaHora, valor FROM LECTURAS WHERE codigoMedidor = ? ORDER BY fechaHora DESC LIMIT 1', [h.codigoMedidor])
      : [];
    ok(res, { ...publico(h), ultimaLectura: ult ? { fechaHora: ult.fechaHora, valor: Number(ult.valor) } : null });
  } catch (e) {
    if (e.status === 404) return ok(res, null, 'Aún no se ha configurado el hogar');
    throw e;
  }
}

function validar(body) {
  const errores = [];
  const d = {};
  const nombre = opcional(errores, body.nombre, 'El nombre de la casa', 80);
  d.nombre = nombre || 'Mi casa';
  d.ciudad = opcional(errores, body.ciudad, 'La ciudad', 80);
  d.tarifa = String(body.tarifa || '1F').toUpperCase();
  if (!CODIGOS.includes(d.tarifa)) errores.push('La tarifa debe ser 1, 1A, 1B, 1C, 1D, 1E o 1F');
  d.mesInicioVerano = Number(body.mesInicioVerano || 5);
  if (!Number.isInteger(d.mesInicioVerano) || d.mesInicioVerano < 1 || d.mesInicioVerano > 12) errores.push('El mes de inicio del verano no es válido');
  d.inicioPeriodo = body.inicioPeriodo ? String(body.inicioPeriodo).slice(0, 10) : null;
  if (d.inicioPeriodo && !FECHA_RE.test(d.inicioPeriodo)) errores.push('La fecha de inicio del periodo no es válida');
  d.personas = numeroOpcional(errores, body.personas, 'El número de personas');
  if (d.personas !== null && (!Number.isInteger(d.personas) || d.personas < 1 || d.personas > 30)) errores.push('El número de personas debe estar entre 1 y 30');
  d.metaBimestralKwh = numeroOpcional(errores, body.metaBimestralKwh, 'La meta bimestral');
  if (d.metaBimestralKwh !== null && d.metaBimestralKwh <= 0) errores.push('La meta bimestral debe ser mayor a 0');
  for (const [k, nom] of [['horaDormirInicio', 'La hora de dormir'], ['horaDormirFin', 'La hora de despertar']]) {
    d[k] = String(body[k] || (k === 'horaDormirInicio' ? '00:00' : '06:00'));
    if (!HORA_RE.test(d[k])) errores.push(`${nom} no es válida`);
  }
  for (const [k, nom, def] of [['consumoBaseW', 'El consumo mínimo', 300], ['consumoNocheW', 'El consumo normal de noche', 1500], ['umbralAltoW', 'El límite de consumo alto', 5000]]) {
    const v = numeroOpcional(errores, body[k], nom);
    d[k] = v === null ? def : v;
    if (d[k] < 0) errores.push(`${nom} no puede ser negativo`);
  }
  if (d.consumoNocheW < d.consumoBaseW) errores.push('El consumo normal de noche debe ser mayor o igual al consumo mínimo');
  if (d.umbralAltoW <= d.consumoNocheW) errores.push('El límite de consumo alto debe ser mayor al consumo normal de noche');
  if (errores.length) throw badRequest('Datos del hogar inválidos', errores);
  return d;
}

// PUT /hogar — crea o actualiza el hogar del titular.
async function guardar(req, res) {
  const datos = validar(req.body || {});
  const r = await db.query('SELECT idHogar FROM HOGARES WHERE idUsuario = ?', [req.user.owner]);
  if (r.length) await db.query('UPDATE HOGARES SET ? WHERE idHogar = ?', [datos, r[0].idHogar]);
  else await db.query('INSERT INTO HOGARES SET ?', [{ ...datos, idUsuario: req.user.owner }]);
  ok(res, publico(await own.hogar(req.user.owner)), r.length ? 'Datos del hogar actualizados' : 'Hogar registrado', r.length ? 200 : 201);
}

// PATCH /hogar/vacaciones  { activo }
async function vacaciones(req, res) {
  const h = await own.hogar(req.user.owner);
  const activo = !!req.body.activo;
  await db.query('UPDATE HOGARES SET modoVacaciones = ? WHERE idHogar = ?', [activo ? 1 : 0, h.idHogar]);
  let apagados = [];
  if (activo) apagados = await apagarPorVacaciones(h.idHogar);
  const okApagados = apagados.filter((a) => a.ok).length;
  ok(res, { modoVacaciones: activo, apagados },
    activo ? `Modo vacaciones activado${apagados.length ? ` · ${okApagados} de ${apagados.length} aparato(s) apagado(s)` : ''}` : 'Modo vacaciones desactivado');
}

// POST /hogar/medidor  { nombre, modelo } — el código se genera solo.
async function registrarMedidor(req, res) {
  const h = await own.hogar(req.user.owner);
  if (h.codigoMedidor) throw conflict('Tu hogar ya tiene un sensor registrado');
  const errores = [];
  const nombre = opcional(errores, req.body.nombre, 'El nombre del sensor', 80) || 'Sensor de consumo';
  const modelo = opcional(errores, req.body.modelo, 'El modelo', 60) || 'Sonoff POW Ring';
  if (errores.length) throw badRequest('Datos inválidos', errores);
  const codigoMedidor = idAleatorio('MED-', 4);
  await db.query('INSERT INTO MEDIDORES SET ?', [{ codigoMedidor, idHogar: h.idHogar, nombre, modelo }]);
  ok(res, { codigoMedidor, token: sensorToken(codigoMedidor) }, 'Sensor registrado', 201);
}

// PATCH /hogar/medidor  { nombre, modelo, activo }
async function actualizarMedidor(req, res) {
  const h = await own.hogar(req.user.owner);
  if (!h.codigoMedidor) throw notFound('Tu hogar no tiene sensor');
  const errores = [];
  const cambios = {};
  if (req.body.nombre !== undefined) cambios.nombre = opcional(errores, req.body.nombre, 'El nombre del sensor', 80) || 'Sensor de consumo';
  if (req.body.modelo !== undefined) cambios.modelo = opcional(errores, req.body.modelo, 'El modelo', 60);
  if (req.body.activo !== undefined) cambios.activo = req.body.activo ? 1 : 0;
  if (errores.length) throw badRequest('Datos inválidos', errores);
  if (Object.keys(cambios).length) await db.query('UPDATE MEDIDORES SET ? WHERE codigoMedidor = ?', [cambios, h.codigoMedidor]);
  ok(res, publico(await own.hogar(req.user.owner)).medidor, 'Sensor actualizado');
}

// DELETE /hogar/medidor — borra también su historial de lecturas.
async function eliminarMedidor(req, res) {
  const h = await own.hogar(req.user.owner);
  if (!h.codigoMedidor) throw notFound('Tu hogar no tiene sensor');
  await db.query('DELETE FROM MEDIDORES WHERE codigoMedidor = ?', [h.codigoMedidor]);
  ok(res, null, 'Sensor eliminado junto con su historial de lecturas');
}

// GET /hogar/medidor/token
async function tokenMedidor(req, res) {
  const h = await own.hogar(req.user.owner);
  if (!h.codigoMedidor) throw notFound('Tu hogar no tiene sensor');
  ok(res, { codigoMedidor: h.codigoMedidor, token: sensorToken(h.codigoMedidor) },
    'Configura este código y token en el sensor (encabezado X-Sensor-Token)');
}

module.exports = { obtener, guardar, vacaciones, registrarMedidor, actualizarMedidor, eliminarMedidor, tokenMedidor, validar, publico };
