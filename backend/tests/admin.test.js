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
  idUsuario: 7, nombre: 'pyme', email: 'pyme@x.com', rol: 'ADMIN', activo: 1, idPropietario: null,
  propietario: null, propietarioActivo: null, edificios: 0, sensores: 0, sensoresInactivos: 0, tecnicos: 0,
  alarmasActivas: 0, bloqueoRecuperacion: 0, ultimoAcceso: '2026-11-19 10:00:00', ...extra,
});

test('la contraseña temporal cumple las reglas y no se repite', () => {
  const a = c.contrasenaTemporal();
  assert.match(a, /^[A-Za-z]{6}-\d{4}$/);
  assert.notEqual(a, c.contrasenaTemporal());
});

test('detecta los problemas de una cuenta', () => {
  const p = c.detectarProblemas({ activo: false, rol: 'TECNICO', idPropietario: null, sensoresInactivos: 2, alarmasActivas: 1, bloqueoRecuperacion: true, ultimoAcceso: null });
  assert.ok(p.includes('Cuenta desactivada'));
  assert.ok(p.includes('Técnico sin empresa asignada'));
  assert.ok(p.includes('2 sensor(es) desactivado(s)'));
  assert.ok(p.includes('Código de recuperación bloqueado por intentos fallidos'));
  assert.ok(p.includes('Nunca ha iniciado sesión'));
  assert.deepEqual(c.detectarProblemas({ activo: true, rol: 'ADMIN', ultimoAcceso: 'x' }), []);
});

test('reglas para cambiar el rol', () => {
  const v = c.validarCambioRol;
  const admin = { idUsuario: 7, rol: 'ADMIN' };
  assert.match(v({ actual: { idUsuario: 1, rol: 'SUPERADMIN' }, nuevoRol: 'ADMIN', idAdmin: 1 }), /propio rol/);
  assert.match(v({ actual: admin, nuevoRol: 'TECNICO', idPropietario: null, idAdmin: 1 }), /empresa/);
  assert.match(v({ actual: admin, nuevoRol: 'TECNICO', idPropietario: 9, idAdmin: 1, propietario: { rol: 'TECNICO' } }), /no es un administrador/);
  assert.match(v({ actual: admin, nuevoRol: 'TECNICO', idPropietario: 9, idAdmin: 1, propietario: { rol: 'ADMIN' }, edificios: 2 }), /edificios/);
  assert.match(v({ actual: admin, nuevoRol: 'SUPERADMIN', idAdmin: 1, tecnicos: 1 }), /técnicos/);
  assert.equal(v({ actual: admin, nuevoRol: 'TECNICO', idPropietario: 9, idAdmin: 1, propietario: { rol: 'ADMIN' } }), null);
  assert.equal(v({ actual: { idUsuario: 8, rol: 'TECNICO' }, nuevoRol: 'ADMIN', idAdmin: 1 }), null);
  assert.equal(v({ actual: admin, nuevoRol: 'X', idAdmin: 1 }), 'Rol no válido');
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

test('crear un técnico exige una empresa válida', async () => {
  responder([{ idUsuario: 9, rol: 'TECNICO' }]);
  await assert.rejects(c.crearUsuario({ body: { rol: 'TECNICO', idPropietario: 9, nombre: 'a', email: 'a@a.com' }, user: superadmin }, resFalsa()), /empresa/);
});

test('crear cuenta sin contraseña devuelve una temporal', async () => {
  responder([], { insertId: 12 }, []);
  const res = resFalsa();
  await c.crearUsuario({ body: { rol: 'ADMIN', nombre: 'nueva', email: 'nueva@x.com' }, user: superadmin }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.data.idUsuario, 12);
  assert.match(res.body.data.contrasenaTemporal, /^[A-Za-z]{6}-\d{4}$/);
  assert.equal(llamadas[2].params[0].accion, 'CREAR_CUENTA');
});
