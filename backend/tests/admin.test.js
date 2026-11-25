const { responder, llamadas } = require('./setup');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const c = require('../src/controllers/adminController');
const { rateLimit, desbloquearCorreo, correoBloqueado, correoDe } = require('../src/middleware/rateLimit');
const { verifyPassword } = require('../src/utils/security');

function resFalsa() {
  return { statusCode: 200, body: null, status(s) { this.statusCode = s; return this; }, json(b) { this.body = b; return this; } };
}
const superadmin = { id: 1, owner: 1, rol: 'SUPERADMIN', nombre: 'root' };
const fila = (extra) => ({
  idUsuario: 7, nombre: 'casa', email: 'casa@x.com', rol: 'TITULAR', activo: 1, idPropietario: null,
  propietario: null, propietarioActivo: null, idHogar: 3, nombreHogar: 'Mi casa', codigoMedidor: 'MED-1', medidorActivo: 1,
  ultimaLectura: '2026-11-19 09:00:00', horasSinLectura: 1, aparatos: 0, familiares: 0,
  alarmasActivas: 0, bloqueoRecuperacion: 0, ultimoAcceso: '2026-11-19 10:00:00', ...extra,
});

test('la contraseña temporal cumple las reglas y no se repite', () => {
  const a = c.contrasenaTemporal();
  assert.match(a, /^[A-Za-z]{6}-\d{4}$/);
  assert.notEqual(a, c.contrasenaTemporal());
});

test('detecta los problemas de una cuenta', () => {
  const p = c.detectarProblemas({ activo: false, rol: 'FAMILIAR', idPropietario: null, alarmasActivas: 1, bloqueoRecuperacion: true, ultimoAcceso: null });
  assert.ok(p.includes('Cuenta desactivada'));
  assert.ok(p.includes('Familiar sin hogar asignado'));
  assert.ok(p.includes('1 aviso(s) activo(s)'));
  assert.ok(p.includes('Código de recuperación bloqueado por intentos fallidos'));
  assert.ok(p.includes('Nunca ha iniciado sesión'));
  const titular = { activo: true, rol: 'TITULAR', ultimoAcceso: 'x', idHogar: 1, codigoMedidor: 'MED-1', medidorActivo: true, ultimaLectura: 'x', horasSinLectura: 2 };
  assert.deepEqual(c.detectarProblemas(titular), []);
  assert.deepEqual(c.detectarProblemas({ ...titular, idHogar: null }), ['Aún no configura su hogar']);
  assert.deepEqual(c.detectarProblemas({ ...titular, codigoMedidor: null }), ['Su hogar no tiene sensor registrado']);
  assert.deepEqual(c.detectarProblemas({ ...titular, horasSinLectura: 50 }), ['El sensor no envía lecturas desde hace 2 día(s)']);
});

test('reglas para cambiar el rol', () => {
  const v = c.validarCambioRol;
  const titular = { idUsuario: 7, rol: 'TITULAR' };
  assert.match(v({ actual: { idUsuario: 1, rol: 'SUPERADMIN' }, nuevoRol: 'TITULAR', idAdmin: 1 }), /propio rol/);
  assert.match(v({ actual: titular, nuevoRol: 'FAMILIAR', idPropietario: null, idAdmin: 1 }), /hogar/);
  assert.match(v({ actual: titular, nuevoRol: 'FAMILIAR', idPropietario: 9, idAdmin: 1, propietario: { rol: 'FAMILIAR' } }), /no es titular/);
  assert.match(v({ actual: titular, nuevoRol: 'FAMILIAR', idPropietario: 9, idAdmin: 1, propietario: { rol: 'TITULAR' }, tieneHogar: true }), /hogar configurado/);
  assert.match(v({ actual: titular, nuevoRol: 'SUPERADMIN', idAdmin: 1, familiares: 1 }), /familiares/);
  assert.equal(v({ actual: titular, nuevoRol: 'FAMILIAR', idPropietario: 9, idAdmin: 1, propietario: { rol: 'TITULAR' } }), null);
  assert.equal(v({ actual: { idUsuario: 8, rol: 'FAMILIAR' }, nuevoRol: 'TITULAR', idAdmin: 1 }), null);
  assert.equal(v({ actual: titular, nuevoRol: 'X', idAdmin: 1 }), 'Rol no válido');
});

test('el administrador no puede desactivarse ni eliminarse a sí mismo', async () => {
  responder([fila({ idUsuario: 1, rol: 'SUPERADMIN' })]);
  await assert.rejects(c.actualizarUsuario({ params: { id: '1' }, body: { activo: false }, user: superadmin }, resFalsa()), /propia cuenta/);
  responder([fila({ idUsuario: 1, rol: 'SUPERADMIN' })]);
  await assert.rejects(c.eliminarUsuario({ params: { id: '1' }, user: superadmin }, resFalsa()), /propia cuenta/);
});

test('desactivar una cuenta la actualiza y lo registra en la bitácora', async () => {
  responder([fila()], [], [], [fila({ activo: 0 })]);
  const res = resFalsa();
  await c.actualizarUsuario({ params: { id: '7' }, body: { activo: false }, user: superadmin }, res);
  assert.match(llamadas[1].sql, /UPDATE USUARIOS SET \?/);
  assert.deepEqual(llamadas[1].params[0], { activo: 0 });
  assert.match(llamadas[2].sql, /INSERT INTO BITACORA_ADMIN/);
  assert.equal(llamadas[2].params[0].accion, 'EDITAR_CUENTA');
  assert.equal(llamadas[2].params[0].idAfectado, 7);
  assert.equal(res.body.data.activo, false);
});

test('un correo repetido al editar se rechaza', async () => {
  responder([fila()], [{ nombre: 'otro', email: 'otro@x.com' }]);
  await assert.rejects(c.actualizarUsuario({ params: { id: '7' }, body: { email: 'otro@x.com' }, user: superadmin }, resFalsa()), /correo ya está registrado/);
});

test('restablecer contraseña genera una temporal, la guarda con hash y anula códigos', async () => {
  responder([fila()]);
  const res = resFalsa();
  await c.restablecerContrasena({ params: { id: '7' }, body: {}, user: superadmin }, res);
  const temporal = res.body.data.contrasenaTemporal;
  assert.match(temporal, /^[A-Za-z]{6}-\d{4}$/);
  const hash = llamadas[1].params[0];
  assert.ok(hash.startsWith('scrypt$'));
  assert.ok(verifyPassword(temporal, hash).ok);
  assert.match(llamadas[2].sql, /UPDATE RECUPERACION_CONTRASENA SET usado = TRUE/);
  assert.match(llamadas[3].sql, /BITACORA_ADMIN/);
});

test('una contraseña escrita débil se rechaza', async () => {
  responder([fila()]);
  await assert.rejects(c.restablecerContrasena({ params: { id: '7' }, body: { contrasena: 'abc' }, user: superadmin }, resFalsa()), /validación/);
});

test('desbloquear quita el bloqueo por intentos fallidos de un correo', () => {
  const mw = rateLimit({ max: 2, clave: correoDe });
  const req = { ip: '1.2.3.4', body: { email: 'Pyme@X.com' } };
  for (let i = 0; i < 3; i++) mw(req, { set() {} }, () => {});
  assert.equal(correoBloqueado('pyme@x.com'), true);
  assert.equal(desbloquearCorreo('pyme@x.com'), 1);
  assert.equal(correoBloqueado('pyme@x.com'), false);
});

test('crear un familiar exige un titular válido', async () => {
  responder([{ idUsuario: 9, rol: 'FAMILIAR' }]);
  await assert.rejects(c.crearUsuario({ body: { rol: 'FAMILIAR', idPropietario: 9, nombre: 'a', email: 'a@a.com' }, user: superadmin }, resFalsa()), /titular/);
});

test('crear cuenta sin contraseña devuelve una temporal', async () => {
  responder([], { insertId: 12 }, []);
  const res = resFalsa();
  await c.crearUsuario({ body: { rol: 'TITULAR', nombre: 'nueva', email: 'nueva@x.com' }, user: superadmin }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.data.idUsuario, 12);
  assert.match(res.body.data.contrasenaTemporal, /^[A-Za-z]{6}-\d{4}$/);
  assert.equal(llamadas[2].params[0].accion, 'CREAR_CUENTA');
});
