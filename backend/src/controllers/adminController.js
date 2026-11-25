// Administrador del sistema (rol SUPERADMIN).
// Ve a todos los usuarios de PowerTech Hogar y puede corregir sus problemas:
// datos de la cuenta, contraseña, bloqueos, rol, activación, medidores y avisos.
// Todo lo que hace queda registrado en BITACORA_ADMIN.
const crypto = require('crypto');
const db = require('../config/db');
const { ok, badRequest, notFound, conflict, forbidden } = require('../utils/http');
const { hashPassword } = require('../utils/security');
const { texto, contrasenaSegura, EMAIL_RE } = require('../utils/validar');
const { validarCuenta, crearCuenta } = require('./userController');
const { desbloquearCorreo, correoBloqueado } = require('../middleware/rateLimit');

const ROLES = ['SUPERADMIN', 'TITULAR', 'FAMILIAR'];
const NOMBRE_ROL = { SUPERADMIN: 'Administrador del sistema', TITULAR: 'Titular del hogar', FAMILIAR: 'Familiar' };
const HORAS_SIN_SENAL = 24;

/* ---------------------------- utilidades ---------------------------- */

// Contraseña temporal legible: 6 letras + guion + 4 números (sin caracteres confusos).
function contrasenaTemporal() {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
  const numeros = '23456789';
  const elegir = (abc, n) => Array.from({ length: n }, () => abc[crypto.randomInt(abc.length)]).join('');
  return `${elegir(letras, 6)}-${elegir(numeros, 4)}`;
}

async function registrar(q, req, afectado, accion, detalle) {
  await q('INSERT INTO BITACORA_ADMIN SET ?', [{
    idAdmin: req.user.id,
    idAfectado: afectado ? afectado.idUsuario : null,
    nombreAfectado: afectado ? afectado.nombre : null,
    accion,
    detalle: detalle ? String(detalle).slice(0, 400) : null,
  }]);
}

// Lista de problemas visibles de una cuenta, para resaltarla en el panel.
function detectarProblemas(u) {
  const p = [];
  if (!u.activo) p.push('Cuenta desactivada');
  if (u.bloqueadoLogin) p.push('Bloqueada por intentos fallidos de inicio de sesión');
  if (u.bloqueoRecuperacion) p.push('Código de recuperación bloqueado por intentos fallidos');
  if (u.rol === 'FAMILIAR' && !u.idPropietario) p.push('Familiar sin hogar asignado');
  if (u.rol === 'FAMILIAR' && u.idPropietario && u.propietarioActivo === 0) p.push('La cuenta del titular de su hogar está desactivada');
  if (u.rol === 'TITULAR') {
    if (!u.idHogar) p.push('Aún no configura su hogar');
    else if (!u.codigoMedidor) p.push('Su hogar no tiene sensor registrado');
    else if (!u.medidorActivo) p.push('El sensor está pausado');
    else if (!u.ultimaLectura) p.push('El sensor nunca ha enviado lecturas');
    else if (Number(u.horasSinLectura) >= HORAS_SIN_SENAL) p.push(`El sensor no envía lecturas desde hace ${Math.floor(Number(u.horasSinLectura) / 24) || 1} día(s)`);
  }
  if (Number(u.alarmasActivas) > 0) p.push(`${u.alarmasActivas} aviso(s) activo(s)`);
  if (!u.ultimoAcceso) p.push('Nunca ha iniciado sesión');
  return p;
}

// Reglas para cambiar el rol de una cuenta. Regresa un mensaje de error o null.
function validarCambioRol({ actual, nuevoRol, idPropietario, idAdmin, tieneHogar = false, familiares = 0, propietario }) {
  if (!ROLES.includes(nuevoRol)) return 'Rol no válido';
  if (actual.idUsuario === idAdmin && nuevoRol !== actual.rol) return 'No puedes cambiar tu propio rol';
  if (nuevoRol === 'FAMILIAR') {
    if (!idPropietario) return 'Un familiar debe pertenecer a un hogar (elige al titular)';
    if (idPropietario === actual.idUsuario) return 'Un familiar no puede pertenecer a sí mismo';
    if (!propietario || propietario.rol !== 'TITULAR') return 'El titular elegido no existe o no es titular de un hogar';
  }
  if (actual.rol !== nuevoRol && actual.rol === 'TITULAR') {
    if (familiares > 0) return 'Esta cuenta tiene familiares. Elimínalos o muévelos antes de cambiar su rol';
    if (tieneHogar) return 'Esta cuenta tiene un hogar configurado. No se le puede cambiar el rol sin perder el acceso a él';
  }
  return null;
}

const SELECT_USUARIO = `
  SELECT u.idUsuario, u.nombre, u.email, u.rol, u.activo, u.idPropietario, u.fechaRegistro, u.ultimoAcceso,
         p.nombre AS propietario, p.activo AS propietarioActivo,
         h.idHogar, h.nombre AS nombreHogar, h.ciudad, h.tarifa, m.codigoMedidor, m.activo AS medidorActivo,
         (SELECT MAX(l.fechaHora) FROM LECTURAS l WHERE l.codigoMedidor = m.codigoMedidor) AS ultimaLectura,
         TIMESTAMPDIFF(HOUR, (SELECT MAX(l.fechaHora) FROM LECTURAS l WHERE l.codigoMedidor = m.codigoMedidor), NOW()) AS horasSinLectura,
         (SELECT COUNT(*) FROM APARATOS ap WHERE ap.idHogar = h.idHogar) AS aparatos,
         (SELECT COUNT(*) FROM USUARIOS f WHERE f.idPropietario = u.idUsuario) AS familiares,
         (SELECT COUNT(*) FROM ALARMAS a WHERE a.idHogar = h.idHogar AND a.estado = 'ACTIVA') AS alarmasActivas,
         EXISTS(SELECT 1 FROM RECUPERACION_CONTRASENA r WHERE r.idUsuario = u.idUsuario AND r.usado = 0
            AND r.intentos >= 5 AND r.fechaExpiracion > NOW()) AS bloqueoRecuperacion
  FROM USUARIOS u
  LEFT JOIN USUARIOS p ON p.idUsuario = u.idPropietario
  LEFT JOIN HOGARES h ON h.idUsuario = u.idUsuario
  LEFT JOIN MEDIDORES m ON m.idHogar = h.idHogar`;

function completar(u) {
  const r = { ...u, activo: !!u.activo, bloqueoRecuperacion: !!u.bloqueoRecuperacion, bloqueadoLogin: correoBloqueado(u.email),
    medidorActivo: u.medidorActivo === null || u.medidorActivo === undefined ? null : !!u.medidorActivo };
  r.nombreRol = NOMBRE_ROL[r.rol] || r.rol;
  r.problemas = detectarProblemas(r);
  return r;
}

async function buscarUsuario(id) {
  const rows = await db.query(`${SELECT_USUARIO} WHERE u.idUsuario = ?`, [Number(id)]);
  if (!rows.length) throw notFound('Usuario no encontrado');
  return completar(rows[0]);
}

/* ---------------------------- consultas ---------------------------- */

// GET /api/admin/resumen
async function resumen(req, res) {
  const [u] = await db.query(`
    SELECT COUNT(*) AS total,
           SUM(rol = 'SUPERADMIN') AS superadmins, SUM(rol = 'TITULAR') AS titulares, SUM(rol = 'FAMILIAR') AS familiares,
           SUM(activo = 0) AS desactivados
    FROM USUARIOS`);
  const [d] = await db.query(`
    SELECT (SELECT COUNT(*) FROM HOGARES) AS hogares,
           (SELECT COUNT(*) FROM MEDIDORES) AS medidores,
           (SELECT COUNT(*) FROM ALARMAS WHERE estado = 'ACTIVA') AS alarmasActivas`);
  const num = (o) => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [k, Number(v) || 0]));
  ok(res, { ...num(u), ...num(d) });
}

// GET /api/admin/usuarios?q=texto&rol=TITULAR
async function listarUsuarios(req, res) {
  const q = texto(req.query.q || '');
  const rol = ROLES.includes(req.query.rol) ? req.query.rol : '';
  const like = `%${q}%`;
  const rows = await db.query(`${SELECT_USUARIO}
    WHERE (? = '' OR u.nombre LIKE ? OR u.email LIKE ?) AND (? = '' OR u.rol = ?)
    ORDER BY FIELD(u.rol, 'SUPERADMIN', 'TITULAR', 'FAMILIAR'), u.nombre
    LIMIT 500`, [q, like, like, rol, rol]);
  ok(res, rows.map(completar));
}

// GET /api/admin/usuarios/:id — todo lo necesario para revisar y corregir una cuenta.
async function detalleUsuario(req, res) {
  const usuario = await buscarUsuario(req.params.id);
  const duenio = usuario.idPropietario || usuario.idUsuario; // un familiar ve el hogar de su titular
  const hogares = await db.query(`
    SELECT h.*, m.codigoMedidor, m.nombre AS nombreMedidor, m.modelo AS modeloMedidor, m.activo AS medidorActivo,
           (SELECT MAX(l.fechaHora) FROM LECTURAS l WHERE l.codigoMedidor = m.codigoMedidor) AS ultimaLectura,
           (SELECT COUNT(*) FROM LECTURAS l WHERE l.codigoMedidor = m.codigoMedidor AND l.fechaHora >= NOW() - INTERVAL 1 DAY) AS lecturas24h
    FROM HOGARES h LEFT JOIN MEDIDORES m ON m.idHogar = h.idHogar WHERE h.idUsuario = ?`, [duenio]);
  const h = hogares[0] || null;
  const [familiares, aparatos, alarmas, bitacora] = await Promise.all([
    db.query('SELECT idUsuario, nombre, email, activo, ultimoAcceso FROM USUARIOS WHERE idPropietario = ? ORDER BY nombre', [usuario.idUsuario]),
    h ? db.query('SELECT idAparato, nombre, tipo, cuarto, potenciaW, horasDia, controlUrl FROM APARATOS WHERE idHogar = ? ORDER BY cuarto, nombre', [h.idHogar]) : [],
    h ? db.query(`
      SELECT codigoAlarma, tipoAlarma, nivel, estado, fechaHora, detalle
      FROM ALARMAS WHERE idHogar = ? AND estado <> 'CERRADA'
      ORDER BY nivel DESC, fechaHora DESC LIMIT 100`, [h.idHogar]) : [],
    db.query(`
      SELECT b.idBitacora, b.accion, b.detalle, b.fechaHora, a.nombre AS admin
      FROM BITACORA_ADMIN b LEFT JOIN USUARIOS a ON a.idUsuario = b.idAdmin
      WHERE b.idAfectado = ? ORDER BY b.idBitacora DESC LIMIT 30`, [usuario.idUsuario]),
  ]);
  ok(res, {
    usuario,
    familiares: familiares.map((f) => ({ ...f, activo: !!f.activo })),
    hogar: h && {
      idHogar: h.idHogar, nombre: h.nombre, ciudad: h.ciudad, tarifa: h.tarifa, personas: h.personas,
      modoVacaciones: !!h.modoVacaciones, consumoBaseW: Number(h.consumoBaseW), consumoNocheW: Number(h.consumoNocheW),
      umbralAltoW: Number(h.umbralAltoW), horaDormirInicio: String(h.horaDormirInicio).slice(0, 5), horaDormirFin: String(h.horaDormirFin).slice(0, 5),
      medidor: h.codigoMedidor ? {
        codigoMedidor: h.codigoMedidor, nombre: h.nombreMedidor, modelo: h.modeloMedidor, activo: !!h.medidorActivo,
        ultimaLectura: h.ultimaLectura, lecturas24h: Number(h.lecturas24h),
      } : null,
    },
    aparatos: aparatos.map((a) => ({ ...a, conEnchufe: !!a.controlUrl, controlUrl: undefined })),
    alarmas,
    bitacora,
  });
}

// GET /api/admin/titulares — titulares de hogar, para asignar familiares.
async function listarTitulares(req, res) {
  ok(res, await db.query("SELECT idUsuario, nombre, email, activo FROM USUARIOS WHERE rol = 'TITULAR' ORDER BY nombre"));
}

// GET /api/admin/bitacora
async function bitacora(req, res) {
  const limite = Math.min(Math.max(Number(req.query.limite) || 50, 1), 200);
  ok(res, await db.query(`
    SELECT b.idBitacora, b.idAfectado, b.nombreAfectado, b.accion, b.detalle, b.fechaHora, a.nombre AS admin
    FROM BITACORA_ADMIN b LEFT JOIN USUARIOS a ON a.idUsuario = b.idAdmin
    ORDER BY b.idBitacora DESC LIMIT ?`, [limite]));
}

/* ---------------------------- correcciones ---------------------------- */

async function propietarioDe(id) {
  if (!id) return null;
  const rows = await db.query('SELECT idUsuario, nombre, rol, activo FROM USUARIOS WHERE idUsuario = ?', [Number(id)]);
  return rows[0] || null;
}

// POST /api/admin/usuarios — crea cualquier tipo de cuenta.
async function crearUsuario(req, res) {
  const rol = String(req.body.rol || 'TITULAR').toUpperCase();
  if (!ROLES.includes(rol)) throw badRequest('Rol no válido');
  let idPropietario = null;
  if (rol === 'FAMILIAR') {
    idPropietario = Number(req.body.idPropietario) || null;
    const p = await propietarioDe(idPropietario);
    if (!p || p.rol !== 'TITULAR') throw badRequest('Elige el titular del hogar al que pertenece el familiar');
  }
  const generada = !req.body.contrasena;
  const contrasena = generada ? contrasenaTemporal() : req.body.contrasena;
  const datos = validarCuenta({ ...req.body, contrasena });
  const usuario = await crearCuenta(datos, rol, idPropietario);
  await registrar(db.query, req, usuario, 'CREAR_CUENTA', `${NOMBRE_ROL[rol]} · ${usuario.email}`);
  ok(res, { ...usuario, contrasenaTemporal: generada ? contrasena : undefined }, 'Cuenta creada correctamente', 201);
}

// PATCH /api/admin/usuarios/:id — corrige nombre, correo, rol, hogar o activación.
async function actualizarUsuario(req, res) {
  const actual = await buscarUsuario(req.params.id);
  const b = req.body || {};
  const cambios = {};
  const notas = [];
  const errores = [];

  if (b.nombre !== undefined) {
    const nombre = texto(b.nombre);
    if (!nombre) errores.push('El nombre es obligatorio');
    else if (nombre.length > 50) errores.push('El nombre no debe superar 50 caracteres');
    else if (nombre !== actual.nombre) { cambios.nombre = nombre; notas.push(`nombre: ${actual.nombre} → ${nombre}`); }
  }
  if (b.email !== undefined) {
    const email = texto(b.email).toLowerCase();
    if (!EMAIL_RE.test(email) || email.length > 120) errores.push('El correo electrónico no es válido');
    else if (email !== actual.email.toLowerCase()) { cambios.email = email; notas.push(`correo: ${actual.email} → ${email}`); }
  }
  if (errores.length) throw badRequest('Errores de validación', errores);

  if (cambios.nombre || cambios.email) {
    const dup = await db.query('SELECT nombre, email FROM USUARIOS WHERE idUsuario <> ? AND (nombre = ? OR LOWER(email) = ?)',
      [actual.idUsuario, cambios.nombre || '', cambios.email || '']);
    if (dup.length) throw conflict(dup.some((u) => u.nombre === cambios.nombre) ? 'Ese nombre de usuario ya está en uso' : 'Ese correo ya está registrado');
  }

  if (b.rol !== undefined || b.idPropietario !== undefined) {
    const nuevoRol = String(b.rol || actual.rol).toUpperCase();
    const idPropietario = nuevoRol === 'FAMILIAR' ? (Number(b.idPropietario ?? actual.idPropietario) || null) : null;
    const propietario = await propietarioDe(idPropietario);
    const error = validarCambioRol({
      actual, nuevoRol, idPropietario, idAdmin: req.user.id,
      tieneHogar: !!actual.idHogar, familiares: Number(actual.familiares), propietario,
    });
    if (error) throw badRequest(error);
    if (nuevoRol !== actual.rol) { cambios.rol = nuevoRol; notas.push(`rol: ${NOMBRE_ROL[actual.rol]} → ${NOMBRE_ROL[nuevoRol]}`); }
    if (idPropietario !== (actual.idPropietario || null)) { cambios.idPropietario = idPropietario; notas.push(`hogar de: ${actual.propietario || 'nadie'} → ${propietario ? propietario.nombre : 'nadie'}`); }
  }

  if (b.activo !== undefined) {
    const activo = !!b.activo;
    if (actual.idUsuario === req.user.id && !activo) throw forbidden('No puedes desactivar tu propia cuenta');
    if (activo !== actual.activo) { cambios.activo = activo ? 1 : 0; notas.push(activo ? 'cuenta activada' : 'cuenta desactivada'); }
  }

  if (!Object.keys(cambios).length) return ok(res, actual, 'No había nada que cambiar');
  await db.transaction(async (q) => {
    await q('UPDATE USUARIOS SET ? WHERE idUsuario = ?', [cambios, actual.idUsuario]);
    await registrar(q, req, actual, 'EDITAR_CUENTA', notas.join('; '));
  });
  ok(res, await buscarUsuario(actual.idUsuario), 'Cuenta actualizada');
}

// POST /api/admin/usuarios/:id/contrasena — fija una contraseña nueva (o genera una temporal).
async function restablecerContrasena(req, res) {
  const u = await buscarUsuario(req.params.id);
  const generada = !req.body || !req.body.contrasena;
  const nueva = generada ? contrasenaTemporal() : req.body.contrasena;
  const errores = [];
  contrasenaSegura(errores, nueva, 'La nueva contraseña');
  if (errores.length) throw badRequest('Errores de validación', errores);
  await db.transaction(async (q) => {
    await q('UPDATE USUARIOS SET contrasena = ? WHERE idUsuario = ?', [hashPassword(nueva), u.idUsuario]);
    await q('UPDATE RECUPERACION_CONTRASENA SET usado = TRUE WHERE idUsuario = ? AND usado = FALSE', [u.idUsuario]);
    await registrar(q, req, u, 'CAMBIAR_CONTRASENA', generada ? 'Se generó una contraseña temporal' : 'Se asignó una contraseña nueva');
  });
  desbloquearCorreo(u.email);
  ok(res, { contrasenaTemporal: generada ? nueva : undefined }, 'Contraseña restablecida. Compártela con el usuario por un medio seguro.');
}

// POST /api/admin/usuarios/:id/desbloquear — quita bloqueos por intentos fallidos.
async function desbloquear(req, res) {
  const u = await buscarUsuario(req.params.id);
  const quitados = desbloquearCorreo(u.email);
  const r = await db.query('UPDATE RECUPERACION_CONTRASENA SET usado = TRUE WHERE idUsuario = ? AND usado = FALSE', [u.idUsuario]);
  await registrar(db.query, req, u, 'DESBLOQUEAR', `Bloqueos de inicio de sesión: ${quitados}; códigos de recuperación anulados: ${r.affectedRows || 0}`);
  ok(res, null, 'La cuenta quedó desbloqueada. El usuario ya puede intentar de nuevo.');
}

// DELETE /api/admin/usuarios/:id — borra la cuenta (y en cascada su información).
async function eliminarUsuario(req, res) {
  const u = await buscarUsuario(req.params.id);
  if (u.idUsuario === req.user.id) throw forbidden('No puedes eliminar tu propia cuenta');
  await db.transaction(async (q) => {
    await registrar(q, req, u, 'ELIMINAR_CUENTA',
      `${NOMBRE_ROL[u.rol]} · ${u.email}${u.idHogar ? ` · hogar «${u.nombreHogar}», aparatos: ${u.aparatos}` : ''}, familiares: ${u.familiares}`);
    await q('DELETE FROM USUARIOS WHERE idUsuario = ?', [u.idUsuario]);
  });
  ok(res, null, 'Cuenta eliminada');
}

// PATCH /api/admin/medidores/:codigo — activa o desactiva el medidor de cualquier hogar.
async function cambiarMedidor(req, res) {
  const rows = await db.query(`
    SELECT m.codigoMedidor, u.idUsuario, u.nombre
    FROM MEDIDORES m JOIN HOGARES h ON h.idHogar = m.idHogar JOIN USUARIOS u ON u.idUsuario = h.idUsuario
    WHERE m.codigoMedidor = ?`, [req.params.codigo]);
  if (!rows.length) throw notFound('Sensor no encontrado');
  const activo = !!req.body.activo;
  await db.query('UPDATE MEDIDORES SET activo = ? WHERE codigoMedidor = ?', [activo ? 1 : 0, req.params.codigo]);
  await registrar(db.query, req, rows[0], 'MEDIDOR', `${req.params.codigo} ${activo ? 'activado' : 'desactivado'}`);
  ok(res, { activo }, `Sensor ${activo ? 'activado' : 'pausado'}`);
}

// POST /api/admin/alarmas/:codigo/cerrar — cierra un aviso que se quedó abierto.
async function cerrarAlarma(req, res) {
  const rows = await db.query(`
    SELECT a.codigoAlarma, a.estado, u.idUsuario, u.nombre
    FROM ALARMAS a JOIN HOGARES h ON h.idHogar = a.idHogar JOIN USUARIOS u ON u.idUsuario = h.idUsuario
    WHERE a.codigoAlarma = ?`, [req.params.codigo]);
  if (!rows.length) throw notFound('Aviso no encontrado');
  if (rows[0].estado === 'CERRADA') return ok(res, null, 'El aviso ya estaba cerrado');
  await db.query("UPDATE ALARMAS SET estado = 'CERRADA', claveActiva = NULL WHERE codigoAlarma = ?", [req.params.codigo]);
  await registrar(db.query, req, rows[0], 'CERRAR_ALARMA', req.params.codigo);
  ok(res, null, 'Aviso cerrado');
}

module.exports = {
  resumen, listarUsuarios, detalleUsuario, listarTitulares, bitacora,
  crearUsuario, actualizarUsuario, restablecerContrasena, desbloquear, eliminarUsuario,
  cambiarMedidor, cerrarAlarma,
  // para pruebas
  contrasenaTemporal, detectarProblemas, validarCambioRol,
};
