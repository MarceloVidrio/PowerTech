// Administrador del sistema (rol SUPERADMIN).
// Ve a todos los usuarios de PowerTech y puede corregir sus problemas:
// datos de la cuenta, contraseña, bloqueos, rol, activación, sensores y alarmas.
// Todo lo que hace queda registrado en BITACORA_ADMIN.
const crypto = require('crypto');
const db = require('../config/db');
const { ok, badRequest, notFound, conflict, forbidden } = require('../utils/http');
const { hashPassword } = require('../utils/security');
const { texto, contrasenaSegura, EMAIL_RE } = require('../utils/validar');
const { validarCuenta, crearCuenta } = require('./userController');
const { desbloquearCorreo, correoBloqueado } = require('../middleware/rateLimit');

const ROLES = ['SUPERADMIN', 'ADMIN', 'TECNICO'];
const NOMBRE_ROL = { SUPERADMIN: 'Administrador del sistema', ADMIN: 'Administrador de empresa', TECNICO: 'Técnico' };

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
  if (u.rol === 'TECNICO' && !u.idPropietario) p.push('Técnico sin empresa asignada');
  if (u.rol === 'TECNICO' && u.idPropietario && u.propietarioActivo === 0) p.push('Su empresa está desactivada');
  if (Number(u.sensoresInactivos) > 0) p.push(`${u.sensoresInactivos} sensor(es) desactivado(s)`);
  if (Number(u.alarmasActivas) > 0) p.push(`${u.alarmasActivas} alarma(s) activa(s)`);
  if (!u.ultimoAcceso) p.push('Nunca ha iniciado sesión');
  return p;
}

// Reglas para cambiar el rol de una cuenta. Regresa un mensaje de error o null.
function validarCambioRol({ actual, nuevoRol, idPropietario, idAdmin, edificios = 0, sensores = 0, tecnicos = 0, propietario }) {
  if (!ROLES.includes(nuevoRol)) return 'Rol no válido';
  if (actual.idUsuario === idAdmin && nuevoRol !== actual.rol) return 'No puedes cambiar tu propio rol';
  if (nuevoRol === 'TECNICO') {
    if (!idPropietario) return 'Un técnico debe pertenecer a una empresa (elige su administrador)';
    if (idPropietario === actual.idUsuario) return 'Un técnico no puede pertenecer a sí mismo';
    if (!propietario || propietario.rol !== 'ADMIN') return 'La empresa elegida no existe o no es un administrador de empresa';
  }
  if (actual.rol !== nuevoRol && (actual.rol === 'ADMIN')) {
    if (tecnicos > 0) return 'Esta cuenta tiene técnicos. Elimínalos o reasígnalos antes de cambiar su rol';
    if (edificios > 0 || sensores > 0) return 'Esta cuenta tiene edificios o sensores. No se le puede cambiar el rol sin perder el acceso a ellos';
  }
  return null;
}

const SELECT_USUARIO = `
  SELECT u.idUsuario, u.nombre, u.email, u.rol, u.activo, u.idPropietario, u.fechaRegistro, u.ultimoAcceso,
         p.nombre AS propietario, p.activo AS propietarioActivo,
         (SELECT COUNT(*) FROM EDIFICIOS e WHERE e.idUsuario = u.idUsuario) AS edificios,
         (SELECT COUNT(*) FROM SENSORES s WHERE s.idUsuario = u.idUsuario) AS sensores,
         (SELECT COUNT(*) FROM SENSORES s WHERE s.idUsuario = u.idUsuario AND s.activo = 0) AS sensoresInactivos,
         (SELECT COUNT(*) FROM USUARIOS t WHERE t.idPropietario = u.idUsuario) AS tecnicos,
         (SELECT COUNT(*) FROM ALARMAS a JOIN EDIFICIOS e2 ON e2.codigoEdificio = a.codigoEdificio
            WHERE e2.idUsuario = u.idUsuario AND a.estado = 'ACTIVA') AS alarmasActivas,
         EXISTS(SELECT 1 FROM RECUPERACION_CONTRASENA r WHERE r.idUsuario = u.idUsuario AND r.usado = 0
            AND r.intentos >= 5 AND r.fechaExpiracion > NOW()) AS bloqueoRecuperacion
  FROM USUARIOS u LEFT JOIN USUARIOS p ON p.idUsuario = u.idPropietario`;

function completar(u) {
  const r = { ...u, activo: !!u.activo, bloqueoRecuperacion: !!u.bloqueoRecuperacion, bloqueadoLogin: correoBloqueado(u.email) };
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
           SUM(rol = 'SUPERADMIN') AS superadmins, SUM(rol = 'ADMIN') AS empresas, SUM(rol = 'TECNICO') AS tecnicos,
           SUM(activo = 0) AS desactivados
    FROM USUARIOS`);
  const [d] = await db.query(`
    SELECT (SELECT COUNT(*) FROM EDIFICIOS) AS edificios,
           (SELECT COUNT(*) FROM SENSORES) AS sensores,
           (SELECT COUNT(*) FROM ALARMAS WHERE estado = 'ACTIVA') AS alarmasActivas`);
  const num = (o) => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [k, Number(v) || 0]));
  ok(res, { ...num(u), ...num(d) });
}

// GET /api/admin/usuarios?q=texto&rol=ADMIN
async function listarUsuarios(req, res) {
  const q = texto(req.query.q || '');
  const rol = ROLES.includes(req.query.rol) ? req.query.rol : '';
  const like = `%${q}%`;
  const rows = await db.query(`${SELECT_USUARIO}
    WHERE (? = '' OR u.nombre LIKE ? OR u.email LIKE ?) AND (? = '' OR u.rol = ?)
    ORDER BY FIELD(u.rol, 'SUPERADMIN', 'ADMIN', 'TECNICO'), u.nombre
    LIMIT 500`, [q, like, like, rol, rol]);
  ok(res, rows.map(completar));
}

// GET /api/admin/usuarios/:id — todo lo necesario para revisar y corregir una cuenta.
async function detalleUsuario(req, res) {
  const usuario = await buscarUsuario(req.params.id);
  const duenio = usuario.idPropietario || usuario.idUsuario; // un técnico ve los datos de su empresa
  const [tecnicos, edificios, sensores, alarmas, bitacora] = await Promise.all([
    db.query('SELECT idUsuario, nombre, email, activo, ultimoAcceso FROM USUARIOS WHERE idPropietario = ? ORDER BY nombre', [usuario.idUsuario]),
    db.query(`
      SELECT e.codigoEdificio, e.nombreEdificio, e.horarioEntrada, e.horarioSalida, e.codigoTarifa,
             (SELECT COUNT(*) FROM SALAS s WHERE s.codigoEdificio = e.codigoEdificio) AS salas,
             (SELECT COUNT(*) FROM DISPOSITIVOS d JOIN SALAS s2 ON s2.codigoSala = d.codigoSala
                WHERE s2.codigoEdificio = e.codigoEdificio) AS dispositivos
      FROM EDIFICIOS e WHERE e.idUsuario = ? ORDER BY e.nombreEdificio`, [duenio]),
    db.query(`
      SELECT s.codigoSensor, s.nombreSensor, s.tipoSensor, s.activo, s.codigoDispositivo, d.nombre AS dispositivo,
             (SELECT MAX(l.fechaHora) FROM LECTURAS l WHERE l.codigoSensor = s.codigoSensor) AS ultimaLectura
      FROM SENSORES s LEFT JOIN DISPOSITIVOS d ON d.codigoDispositivo = s.codigoDispositivo
      WHERE s.idUsuario = ? ORDER BY s.codigoSensor`, [duenio]),
    db.query(`
      SELECT a.codigoAlarma, a.codigoSensor, a.tipoAlarma, a.nivel, a.estado, a.fechaHora, a.detalle,
             e.nombreEdificio, s.nombreSala
      FROM ALARMAS a
      JOIN EDIFICIOS e ON a.codigoEdificio = e.codigoEdificio
      JOIN SALAS s ON a.codigoSala = s.codigoSala
      WHERE e.idUsuario = ? AND a.estado <> 'CERRADA'
      ORDER BY a.nivel DESC, a.fechaHora DESC LIMIT 100`, [duenio]),
    db.query(`
      SELECT b.idBitacora, b.accion, b.detalle, b.fechaHora, a.nombre AS admin
      FROM BITACORA_ADMIN b LEFT JOIN USUARIOS a ON a.idUsuario = b.idAdmin
      WHERE b.idAfectado = ? ORDER BY b.idBitacora DESC LIMIT 30`, [usuario.idUsuario]),
  ]);
  ok(res, {
    usuario,
    tecnicos: tecnicos.map((t) => ({ ...t, activo: !!t.activo })),
    edificios,
    sensores: sensores.map((s) => ({ ...s, activo: !!s.activo })),
    alarmas,
    bitacora,
  });
}

// GET /api/admin/empresas — administradores de empresa, para asignar técnicos.
async function listarEmpresas(req, res) {
  ok(res, await db.query("SELECT idUsuario, nombre, email, activo FROM USUARIOS WHERE rol = 'ADMIN' ORDER BY nombre"));
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
  const rol = String(req.body.rol || 'ADMIN').toUpperCase();
  if (!ROLES.includes(rol)) throw badRequest('Rol no válido');
  let idPropietario = null;
  if (rol === 'TECNICO') {
    idPropietario = Number(req.body.idPropietario) || null;
    const p = await propietarioDe(idPropietario);
    if (!p || p.rol !== 'ADMIN') throw badRequest('Elige la empresa (administrador) a la que pertenece el técnico');
  }
  const generada = !req.body.contrasena;
  const contrasena = generada ? contrasenaTemporal() : req.body.contrasena;
  const datos = validarCuenta({ ...req.body, contrasena });
  const usuario = await crearCuenta(datos, rol, idPropietario);
  await registrar(db.query, req, usuario, 'CREAR_CUENTA', `${NOMBRE_ROL[rol]} · ${usuario.email}`);
  ok(res, { ...usuario, contrasenaTemporal: generada ? contrasena : undefined }, 'Cuenta creada correctamente', 201);
}

// PATCH /api/admin/usuarios/:id — corrige nombre, correo, rol, empresa o activación.
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
    const idPropietario = nuevoRol === 'TECNICO' ? (Number(b.idPropietario ?? actual.idPropietario) || null) : null;
    const propietario = await propietarioDe(idPropietario);
    const error = validarCambioRol({
      actual, nuevoRol, idPropietario, idAdmin: req.user.id,
      edificios: Number(actual.edificios), sensores: Number(actual.sensores), tecnicos: Number(actual.tecnicos),
      propietario,
    });
    if (error) throw badRequest(error);
    if (nuevoRol !== actual.rol) { cambios.rol = nuevoRol; notas.push(`rol: ${NOMBRE_ROL[actual.rol]} → ${NOMBRE_ROL[nuevoRol]}`); }
    if (idPropietario !== (actual.idPropietario || null)) { cambios.idPropietario = idPropietario; notas.push(`empresa: ${actual.propietario || 'ninguna'} → ${propietario ? propietario.nombre : 'ninguna'}`); }
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
      `${NOMBRE_ROL[u.rol]} · ${u.email} · edificios: ${u.edificios}, sensores: ${u.sensores}, técnicos: ${u.tecnicos}`);
    await q('DELETE FROM USUARIOS WHERE idUsuario = ?', [u.idUsuario]);
  });
  ok(res, null, 'Cuenta eliminada');
}

// PATCH /api/admin/sensores/:codigo — activa o desactiva un sensor de cualquier cuenta.
async function cambiarSensor(req, res) {
  const rows = await db.query(
    'SELECT s.codigoSensor, s.activo, u.idUsuario, u.nombre FROM SENSORES s JOIN USUARIOS u ON u.idUsuario = s.idUsuario WHERE s.codigoSensor = ?',
    [req.params.codigo]);
  if (!rows.length) throw notFound('Sensor no encontrado');
  const activo = !!req.body.activo;
  await db.query('UPDATE SENSORES SET activo = ? WHERE codigoSensor = ?', [activo ? 1 : 0, req.params.codigo]);
  await registrar(db.query, req, rows[0], 'SENSOR', `${req.params.codigo} ${activo ? 'activado' : 'desactivado'}`);
  ok(res, { activo }, `Sensor ${activo ? 'activado' : 'desactivado'}`);
}

// POST /api/admin/alarmas/:codigo/cerrar — cierra una alarma que se quedó abierta.
async function cerrarAlarma(req, res) {
  const rows = await db.query(`
    SELECT a.codigoAlarma, a.estado, u.idUsuario, u.nombre
    FROM ALARMAS a JOIN EDIFICIOS e ON e.codigoEdificio = a.codigoEdificio JOIN USUARIOS u ON u.idUsuario = e.idUsuario
    WHERE a.codigoAlarma = ?`, [req.params.codigo]);
  if (!rows.length) throw notFound('Alarma no encontrada');
  if (rows[0].estado === 'CERRADA') return ok(res, null, 'La alarma ya estaba cerrada');
  await db.query("UPDATE ALARMAS SET estado = 'CERRADA', claveActiva = NULL WHERE codigoAlarma = ?", [req.params.codigo]);
  await registrar(db.query, req, rows[0], 'CERRAR_ALARMA', req.params.codigo);
  ok(res, null, 'Alarma cerrada');
}

module.exports = {
  resumen, listarUsuarios, detalleUsuario, listarEmpresas, bitacora,
  crearUsuario, actualizarUsuario, restablecerContrasena, desbloquear, eliminarUsuario,
  cambiarSensor, cerrarAlarma,
  // para pruebas
  contrasenaTemporal, detectarProblemas, validarCambioRol,
};
