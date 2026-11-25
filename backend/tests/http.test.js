const { responder } = require('./setup');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { errorHandler, badRequest } = require('../src/utils/http');
const { requireAuth, requireRole, sameUserParam } = require('../src/middleware/auth');
const { rateLimit } = require('../src/middleware/rateLimit');
const { signToken } = require('../src/utils/security');

function resFalsa() {
  return { statusCode: 200, body: null, headers: {}, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; }, set(h, v) { this.headers[h] = v; return this; } };
}

test('los errores internos no exponen detalles de la base de datos', () => {
  const res = resFalsa();
  const original = console.error; console.error = () => {};
  errorHandler(Object.assign(new Error('Table x doesnt exist'), { sqlMessage: 'secreto' }), { method: 'GET', originalUrl: '/x' }, res);
  console.error = original;
  assert.equal(res.statusCode, 500);
  assert.ok(!JSON.stringify(res.body).includes('secreto'));
});

test('los errores conocidos llegan con su mensaje y código', () => {
  const res = resFalsa();
  errorHandler(badRequest('Dato inválido', ['x']), {}, res);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: true, mensaje: 'Dato inválido', detalles: ['x'] });
  const res2 = resFalsa();
  errorHandler({ code: 'ER_DUP_ENTRY' }, {}, res2);
  assert.equal(res2.statusCode, 409);
});

test('las rutas protegidas exigen un token válido y una cuenta activa', async () => {
  let err;
  await requireAuth({ headers: {} }, {}, (e) => { err = e; });
  assert.equal(err.status, 401);
  // El rol y el hogar se toman de la base (no del token), por si el administrador los cambió.
  responder([{ idUsuario: 5, nombre: 'hijo', rol: 'FAMILIAR', idPropietario: 3, activo: 1 }]);
  const req = { headers: { authorization: `Bearer ${signToken({ sub: 5, own: 3, rol: 'TITULAR' })}` } };
  err = 'sin llamar';
  await requireAuth(req, {}, (e) => { err = e; });
  assert.equal(err, undefined);
  assert.deepEqual([req.user.id, req.user.owner, req.user.rol], [5, 3, 'FAMILIAR']);
  // Cuenta desactivada o eliminada → 401
  responder([{ idUsuario: 5, nombre: 'hijo', rol: 'FAMILIAR', idPropietario: 3, activo: 0 }]);
  await requireAuth({ headers: req.headers }, {}, (e) => { err = e; });
  assert.equal(err.status, 401);
  assert.match(err.message, /desactivada/);
  responder([]);
  await requireAuth({ headers: req.headers }, {}, (e) => { err = e; });
  assert.equal(err.status, 401);
});

test('un familiar no puede hacer cambios ni pedir datos de otro usuario', () => {
  let err;
  requireRole('TITULAR')({ user: { rol: 'FAMILIAR' } }, {}, (e) => { err = e; });
  assert.equal(err.status, 403);
  assert.match(err.message, /titular/);
  sameUserParam()({ user: { id: 5 }, params: { id: '9' } }, {}, (e) => { err = e; });
  assert.equal(err.status, 403);
  sameUserParam()({ user: { id: 5 }, params: { id: '5' } }, {}, (e) => { err = e; });
  assert.equal(err, undefined);
});

test('el limitador bloquea después del máximo de intentos', () => {
  const mw = rateLimit({ max: 3, clave: () => 'k' });
  const errores = [];
  for (let i = 0; i < 5; i++) mw({}, resFalsa(), (e) => errores.push(e));
  assert.equal(errores.filter(Boolean).length, 2);
  assert.equal(errores[4].status, 429);
});
