import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readStoredUser, saveStoredUser, tokenVencido } from '../src/utils/userStorage.js';

const token = (exp) => `x.${Buffer.from(JSON.stringify({ sub: 7, exp })).toString('base64url')}.y`;

test('restores a valid user and rejects corrupt or incomplete storage', () => {
  const user = { idUsuario: 7, nombre: 'Paulina', token: 'abc.def.ghi' };
  assert.deepEqual(readStoredUser({ getItem: () => JSON.stringify(user) }), user);
  for (const value of [null, '{broken', 'null', '[]', '{}', 'true', '"text"', '{"idUsuario":7}']) {
    assert.equal(readStoredUser({ getItem: () => value }), null);
  }
});

test('storage access failures do not prevent login or logout', () => {
  const blocked = () => { throw new Error('Storage denied'); };
  assert.equal(readStoredUser(blocked), null);
  assert.doesNotThrow(() => saveStoredUser(blocked, { idUsuario: 7, token: 't' }));
  assert.doesNotThrow(() => saveStoredUser(blocked, null));
});

test('persists login and removes the stored user on logout', () => {
  const entries = new Map();
  const storage = {
    getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: key => entries.delete(key),
  };
  saveStoredUser(storage, { idUsuario: 7, token: 't' });
  assert.deepEqual(readStoredUser(storage), { idUsuario: 7, token: 't' });
  saveStoredUser(storage, null);
  assert.equal(readStoredUser(storage), null);
});

test('detects expired or malformed tokens', () => {
  const ahora = Date.now();
  assert.equal(tokenVencido(token(Math.floor(ahora / 1000) + 3600), ahora), false);
  assert.equal(tokenVencido(token(Math.floor(ahora / 1000) - 10), ahora), true);
  assert.equal(tokenVencido('basura', ahora), true);
});
