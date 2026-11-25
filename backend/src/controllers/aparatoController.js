// Aparatos de la casa: inventario (para estimar qué gasta más) y enchufes
// inteligentes opcionales para apagarlos a distancia.
const db = require('../config/db');
const own = require('../services/ownership');
const { ok, badRequest, HttpError } = require('../utils/http');
const { requerido, opcional, numeroOpcional } = require('../utils/validar');
const { enviarComando, validarUrl } = require('../services/controlService');
const { estimarAparatos } = require('../services/consumoService');
const { periodoBimestral } = require('../services/tarifaCFE');

const TIPOS = ['MINISPLIT', 'REFRIGERADOR', 'LAVADORA', 'SECADORA', 'TELEVISION', 'COMPUTADORA', 'ILUMINACION',
  'BOMBA', 'CALENTADOR', 'MICROONDAS', 'PLANCHA', 'VENTILADOR', 'OTRO'];

const publico = (a) => ({
  idAparato: a.idAparato, nombre: a.nombre, tipo: a.tipo, cuarto: a.cuarto,
  potenciaW: a.potenciaW === null ? null : Number(a.potenciaW),
  horasDia: a.horasDia === null ? null : Number(a.horasDia),
  controlUrl: a.controlUrl, conEnchufe: !!a.controlUrl,
  apagarAlDormir: !!a.apagarAlDormir, apagarEnVacaciones: !!a.apagarEnVacaciones,
});

function validar(body) {
  const errores = [];
  const nombre = requerido(errores, body.nombre, 'El nombre del aparato', 80);
  const tipo = String(body.tipo || 'OTRO').toUpperCase();
  if (!TIPOS.includes(tipo)) errores.push('El tipo de aparato no es válido');
  const cuarto = opcional(errores, body.cuarto, 'El cuarto', 60);
  const potenciaW = numeroOpcional(errores, body.potenciaW, 'La potencia');
  if (potenciaW !== null && (potenciaW < 0 || potenciaW > 50000)) errores.push('La potencia debe estar entre 0 y 50,000 W');
  const horasDia = numeroOpcional(errores, body.horasDia, 'Las horas de uso al día');
  if (horasDia !== null && (horasDia < 0 || horasDia > 24)) errores.push('Las horas de uso deben estar entre 0 y 24');
  const controlUrl = opcional(errores, body.controlUrl, 'La dirección del enchufe', 255);
  if (controlUrl && !validarUrl(controlUrl)) errores.push('La dirección del enchufe debe iniciar con http:// o https://');
  if (errores.length) throw badRequest('Datos del aparato inválidos', errores);
  return {
    nombre, tipo, cuarto, potenciaW, horasDia, controlUrl,
    apagarAlDormir: controlUrl && body.apagarAlDormir ? 1 : 0,
    apagarEnVacaciones: controlUrl && body.apagarEnVacaciones ? 1 : 0,
  };
}

// GET /aparatos — lista con el consumo estimado de cada uno en el bimestre.
async function listar(req, res) {
  const h = await own.hogar(req.user.owner);
  const rows = await db.query('SELECT * FROM APARATOS WHERE idHogar = ? ORDER BY cuarto, nombre', [h.idHogar]);
  const estimados = new Map(estimarAparatos(rows, periodoBimestral(h.inicioPeriodo).diasTotales).map((e) => [e.idAparato, e]));
  ok(res, rows.map((a) => ({ ...publico(a), estimado: estimados.get(a.idAparato) || null })));
}

// POST /aparatos
async function crear(req, res) {
  const h = await own.hogar(req.user.owner);
  const datos = validar(req.body || {});
  const r = await db.query('INSERT INTO APARATOS SET ?', [{ ...datos, idHogar: h.idHogar }]);
  ok(res, { idAparato: r.insertId, ...datos }, 'Aparato agregado', 201);
}

// PUT /aparatos/:id
async function actualizar(req, res) {
  const a = await own.aparato(req.user.owner, req.params.id);
  const datos = validar(req.body || {});
  await db.query('UPDATE APARATOS SET ? WHERE idAparato = ?', [datos, a.idAparato]);
  ok(res, { idAparato: a.idAparato, ...datos }, 'Aparato actualizado');
}

// DELETE /aparatos/:id
async function eliminar(req, res) {
  const a = await own.aparato(req.user.owner, req.params.id);
  await db.query('DELETE FROM APARATOS WHERE idAparato = ?', [a.idAparato]);
  ok(res, null, 'Aparato eliminado');
}

// POST /aparatos/:id/power  { estado: "ON" | "OFF" }
async function encenderApagar(req, res) {
  const a = await own.aparato(req.user.owner, req.params.id);
  if (!a.controlUrl) throw badRequest('Este aparato no tiene un enchufe inteligente configurado');
  const estado = String(req.body.estado || '').toUpperCase();
  if (!['ON', 'OFF'].includes(estado)) throw badRequest('El estado debe ser ON u OFF');
  try {
    await enviarComando(a.controlUrl, estado);
  } catch (e) {
    console.error(`Enchufe de ${a.nombre}:`, e.message);
    throw new HttpError(502, 'No se pudo comunicar con el enchufe inteligente. Revisa que esté conectado al WiFi.');
  }
  ok(res, { estado }, estado === 'ON' ? `${a.nombre} encendido` : `${a.nombre} apagado`);
}

module.exports = { listar, crear, actualizar, eliminar, encenderApagar, validar, TIPOS };
