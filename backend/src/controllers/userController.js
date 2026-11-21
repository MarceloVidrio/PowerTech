// Usuarios: inicio de sesión, registro, recuperación de contraseña y técnicos.
const db = require('../config/db');
const { ok, badRequest, unauthorized, notFound, conflict } = require('../utils/http');
const { hashPassword, verifyPassword, signToken, codigoNumerico, sha256, igualSeguro } = require('../utils/security');
const { requerido, contrasenaSegura, EMAIL_RE } = require('../utils/validar');
const { enviarCorreo } = require('../utils/mailer');

const MAX_INTENTOS = 5;
const MINUTOS_CODIGO = 10;

function sesion(u) {
  const owner = u.idPropietario || u.idUsuario;
  const token = signToken({ sub: u.idUsuario, own: owner, rol: u.rol || 'ADMIN', nombre: u.nombre });
  return { idUsuario: u.idUsuario, nombre: u.nombre, email: u.email, rol: u.rol || 'ADMIN', token };
}

// POST /user/login
async function login(req, res) {
  const email = String(req.body.email || '').trim().toLowerCase();
  const contrasena = String(req.body.contrasena || '');
  if (!email || !contrasena) throw badRequest('Datos incompletos', ['El correo y la contraseña son obligatorios']);

  const rows = await db.query(
    'SELECT idUsuario, nombre, email, contrasena, rol, idPropietario, activo FROM USUARIOS WHERE LOWER(email) = ?', [email]);
  const u = rows[0];
  const v = verifyPassword(contrasena, u && u.contrasena);
  if (!u || !v.ok) throw unauthorized('Correo o contraseña incorrectos');
  if (!u.activo) throw unauthorized('Tu cuenta está desactivada. Contacta al administrador.');

  // Cuentas antiguas guardaban la contraseña en texto plano: se convierte a hash.
  if (v.rehash) await db.query('UPDATE USUARIOS SET contrasena = ? WHERE idUsuario = ?', [hashPassword(contrasena), u.idUsuario]);
  await db.query('UPDATE USUARIOS SET ultimoAcceso = NOW() WHERE idUsuario = ?', [u.idUsuario]);

  ok(res, sesion(u), 'Inicio de sesión exitoso');
}

function validarCuenta(body) {
  const errores = [];
  const nombre = requerido(errores, body.nombre, 'El nombre', 50);
  const email = requerido(errores, body.email, 'El correo electrónico', 120).toLowerCase();
  if (email && !EMAIL_RE.test(email)) errores.push('El correo electrónico no es válido');
  const contrasena = contrasenaSegura(errores, body.contrasena);
  if (errores.length) throw badRequest('Errores de validación', errores);
  return { nombre, email, contrasena };
}

async function crearCuenta({ nombre, email, contrasena }, rol, idPropietario = null) {
  const existentes = await db.query('SELECT nombre, email FROM USUARIOS WHERE nombre = ? OR LOWER(email) = ?', [nombre, email]);
  if (existentes.length) {
    const nom = existentes.some((u) => u.nombre === nombre);
    const mail = existentes.some((u) => u.email.toLowerCase() === email);
    throw conflict(nom && mail ? 'El nombre de usuario y el correo ya están registrados'
      : nom ? 'El nombre de usuario ya está en uso' : 'El correo electrónico ya está registrado');
  }
  const r = await db.query('INSERT INTO USUARIOS SET ?', [{ nombre, email, contrasena: hashPassword(contrasena), rol, idPropietario }]);
  return { idUsuario: r.insertId, nombre, email, rol };
}

// POST /user  (registro público: crea la cuenta de administrador de una PyME)
async function crear(req, res) {
  const usuario = await crearCuenta(validarCuenta(req.body), 'ADMIN');
  ok(res, usuario, 'Usuario registrado con éxito', 201);
}

// POST /user/recover — siempre responde lo mismo para no revelar qué correos existen.
async function recover(req, res) {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!email) throw badRequest('El correo electrónico es obligatorio');
  const mensaje = 'Si el correo está registrado, recibirás un código de verificación.';

  const rows = await db.query('SELECT idUsuario, nombre, email FROM USUARIOS WHERE LOWER(email) = ?', [email]);
  if (!rows.length) return ok(res, null, mensaje);
  const u = rows[0];

  const codigo = codigoNumerico();
  const expira = new Date(Date.now() + MINUTOS_CODIGO * 60 * 1000);
  // Solo un código vigente por usuario: se invalidan los anteriores.
  await db.query('UPDATE RECUPERACION_CONTRASENA SET usado = TRUE WHERE idUsuario = ? AND usado = FALSE', [u.idUsuario]);
  await db.query(
    'INSERT INTO RECUPERACION_CONTRASENA (idUsuario, codigo, fechaExpiracion, usado, intentos) VALUES (?, ?, ?, FALSE, 0)',
    [u.idUsuario, sha256(codigo), expira]);

  try {
    await enviarCorreo({
      para: u.email,
      asunto: 'Código de recuperación - PowerTech',
      texto: `Hola ${u.nombre},\n\nTu código de recuperación de PowerTech es: ${codigo}\n\nEste código vence en ${MINUTOS_CODIGO} minutos.\n\nSi no lo solicitaste, ignora este correo.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:30px">
        <h2 style="color:#478D4B">PowerTech</h2>
        <p>Recibimos una solicitud para recuperar tu contraseña. Tu código de verificación es:</p>
        <div style="font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;padding:20px;background:#f1f1f1;color:#478D4B;border-radius:8px">${codigo}</div>
        <p>Este código vence en <strong>${MINUTOS_CODIGO} minutos</strong> y solo se puede usar una vez.</p>
        <p>Si no solicitaste recuperar tu contraseña, puedes ignorar este correo.</p></div>`,
    });
  } catch (e) {
    console.error('Error al enviar el correo de recuperación:', e.message);
  }
  ok(res, null, mensaje);
}

// Busca el código vigente y lo compara; cuenta los intentos fallidos.
async function validarCodigo(email, codigo) {
  const rows = await db.query(
    `SELECT r.idRecuperacion, r.idUsuario, r.codigo, r.intentos
     FROM RECUPERACION_CONTRASENA r JOIN USUARIOS u ON u.idUsuario = r.idUsuario
     WHERE LOWER(u.email) = ? AND r.usado = FALSE AND r.fechaExpiracion > NOW()
     ORDER BY r.idRecuperacion DESC LIMIT 1`, [String(email || '').trim().toLowerCase()]);
  const r = rows[0];
  const invalido = badRequest('El código no es válido o ya venció. Solicita uno nuevo.');
  if (!r || r.intentos >= MAX_INTENTOS) throw invalido;
  if (!igualSeguro(sha256(String(codigo || '').trim()), r.codigo)) {
    await db.query('UPDATE RECUPERACION_CONTRASENA SET intentos = intentos + 1 WHERE idRecuperacion = ?', [r.idRecuperacion]);
    throw invalido;
  }
  return r;
}

// POST /user/verify-code
async function verificarCodigo(req, res) {
  if (!req.body.email || !req.body.codigo) throw badRequest('El correo y el código son obligatorios');
  await validarCodigo(req.body.email, req.body.codigo);
  ok(res, null, 'Código verificado correctamente');
}

// POST /user/reset-password
async function cambiarContrasena(req, res) {
  const { email, codigo, nuevaContrasena } = req.body;
  if (!email || !codigo) throw badRequest('El correo y el código son obligatorios');
  const errores = [];
  contrasenaSegura(errores, nuevaContrasena, 'La nueva contraseña');
  if (errores.length) throw badRequest('Errores de validación', errores);

  const r = await validarCodigo(email, codigo);
  await db.transaction(async (q) => {
    await q('UPDATE USUARIOS SET contrasena = ? WHERE idUsuario = ?', [hashPassword(nuevaContrasena), r.idUsuario]);
    await q('UPDATE RECUPERACION_CONTRASENA SET usado = TRUE WHERE idRecuperacion = ?', [r.idRecuperacion]);
  });
  ok(res, null, 'Contraseña actualizada correctamente');
}

// GET /user/:id/perfil
async function obtenerDatosRelacionados(req, res) {
  const rows = await db.query(
    `SELECT e.codigoEdificio, e.nombreEdificio, e.horarioEntrada, e.horarioSalida, s.codigoSala, s.nombreSala
     FROM EDIFICIOS e LEFT JOIN SALAS s ON e.codigoEdificio = s.codigoEdificio
     WHERE e.idUsuario = ?`, [req.user.owner]);
  const mapa = {};
  for (const row of rows) {
    if (!mapa[row.codigoEdificio]) {
      mapa[row.codigoEdificio] = { codigo: row.codigoEdificio, nombre: row.nombreEdificio, horario: `${row.horarioEntrada} - ${row.horarioSalida}`, salas: [] };
    }
    if (row.codigoSala) mapa[row.codigoEdificio].salas.push({ codigo: row.codigoSala, nombre: row.nombreSala });
  }
  const data = Object.values(mapa);
  ok(res, data, data.length ? 'Datos recuperados' : 'El usuario no tiene edificios registrados');
}

// GET /user/tecnicos
async function listarTecnicos(req, res) {
  const rows = await db.query('SELECT idUsuario, nombre, email, rol FROM USUARIOS WHERE idPropietario = ? ORDER BY nombre', [req.user.id]);
  ok(res, rows);
}

// POST /user/tecnicos — el administrador da de alta a un técnico de su empresa.
async function crearTecnico(req, res) {
  const usuario = await crearCuenta(validarCuenta(req.body), 'TECNICO', req.user.id);
  ok(res, usuario, 'Técnico registrado correctamente', 201);
}

// DELETE /user/tecnicos/:id
async function eliminarTecnico(req, res) {
  const r = await db.query('DELETE FROM USUARIOS WHERE idUsuario = ? AND idPropietario = ?', [req.params.id, req.user.id]);
  if (!r.affectedRows) throw notFound('Técnico no encontrado');
  ok(res, null, 'Técnico eliminado');
}

module.exports = { validarCuenta, crearCuenta, login, crear, recover, verificarCodigo, cambiarContrasena, obtenerDatosRelacionados, listarTecnicos, crearTecnico, eliminarTecnico };
