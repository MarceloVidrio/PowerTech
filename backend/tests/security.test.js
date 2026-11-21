require('./setup');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const s = require('../src/utils/security');

test('las contraseñas se guardan con hash y se verifican', () => {
  const h = s.hashPassword('Secreta123');
  assert.ok(h.startsWith('scrypt$'));
  assert.ok(!h.includes('Secreta123'));
  assert.deepEqual(s.verifyPassword('Secreta123', h), { ok: true, rehash: false });
  assert.equal(s.verifyPassword('otra', h).ok, false);
});

test('una contraseña antigua en texto plano funciona una vez y pide rehash', () => {
  assert.deepEqual(s.verifyPassword('vieja1', 'vieja1'), { ok: true, rehash: true });
  assert.equal(s.verifyPassword('mala', 'vieja1').ok, false);
  assert.equal(s.verifyPassword('x', null).ok, false);
});

test('el token de sesión se firma, se valida y detecta alteraciones', () => {
  const t = s.signToken({ sub: 7, own: 7, rol: 'ADMIN' });
  assert.equal(s.verifyToken(t).sub, 7);
  const [h, b, f] = t.split('.');
  const otro = Buffer.from(JSON.stringify({ sub: 1, own: 1, rol: 'ADMIN', exp: 9999999999 })).toString('base64url');
  assert.equal(s.verifyToken(`${h}.${otro}.${f}`), null);
  assert.equal(s.verifyToken('basura'), null);
  assert.equal(s.verifyToken(s.signToken({ sub: 7 }, -1)), null); // expirado
  assert.equal(s.verifyToken(t, 'otro-secreto-distinto-con-mas-de-32-caracteres'), null);
});

test('cada sensor tiene un token distinto', () => {
  const a = s.sensorToken('SENS-01');
  assert.equal(a.length, 40);
  assert.notEqual(a, s.sensorToken('SENS-02'));
  assert.ok(s.verifySensorToken('SENS-01', a));
  assert.ok(!s.verifySensorToken('SENS-02', a));
  assert.ok(!s.verifySensorToken('SENS-01', undefined));
});

test('el código de recuperación tiene 6 dígitos', () => {
  for (let i = 0; i < 50; i++) assert.match(s.codigoNumerico(), /^\d{6}$/);
});
