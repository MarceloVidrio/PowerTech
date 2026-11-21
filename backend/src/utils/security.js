// Seguridad sin dependencias externas: usa el módulo crypto de Node.
//  - Contraseñas: scrypt con sal aleatoria (formato "scrypt$N$r$p$sal$hash").
//  - Sesión: JWT firmado con HMAC-SHA256.
//  - Sensores: token por sensor = HMAC(DEVICE_SECRET, codigoSensor).
const crypto = require('crypto');
const { config } = require('../config/env');

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

function hashPassword(plain) {
  const sal = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(plain), sal, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, sal.toString('base64'), hash.toString('base64')].join('$');
}

function esHash(valor) {
  return typeof valor === 'string' && valor.startsWith('scrypt$');
}

function igualSeguro(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) {
    crypto.timingSafeEqual(ba, ba); // tiempo constante aunque difiera la longitud
    return false;
  }
  return crypto.timingSafeEqual(ba, bb);
}

// Devuelve { ok, rehash }. rehash = true cuando la contraseña guardada estaba
// en texto plano (cuentas creadas antes de esta versión): se debe convertir a hash.
function verifyPassword(plain, guardado) {
  if (!guardado) return { ok: false, rehash: false };
  if (!esHash(guardado)) return { ok: igualSeguro(plain, guardado), rehash: true };
  const [, N, r, p, salB64, hashB64] = guardado.split('$');
  const esperado = Buffer.from(hashB64, 'base64');
  const calculado = crypto.scryptSync(String(plain), Buffer.from(salB64, 'base64'), esperado.length, { N: Number(N), r: Number(r), p: Number(p) });
  return { ok: crypto.timingSafeEqual(esperado, calculado), rehash: false };
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');

function signToken(payload, horas = config.jwtHoras, secret = config.jwtSecret) {
  if (!secret) throw new Error('JWT_SECRET no está configurado');
  const ahora = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ ...payload, iat: ahora, exp: ahora + Math.round(horas * 3600) }));
  const firma = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${firma}`;
}

// Devuelve el payload o null si el token es inválido o expiró.
function verifyToken(token, secret = config.jwtSecret) {
  if (!token || typeof token !== 'string' || !secret) return null;
  const partes = token.split('.');
  if (partes.length !== 3) return null;
  const [header, body, firma] = partes;
  const esperada = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  if (!igualSeguro(firma, esperada)) return null;
  try {
    const h = JSON.parse(Buffer.from(header, 'base64url').toString());
    if (h.alg !== 'HS256') return null;
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!p.exp || p.exp < Math.floor(Date.now() / 1000)) return null;
    return p;
  } catch {
    return null;
  }
}

function sensorToken(codigoSensor, secret = config.deviceSecret) {
  if (!secret) throw new Error('DEVICE_SECRET no está configurado');
  return crypto.createHmac('sha256', secret).update(String(codigoSensor)).digest('hex').slice(0, 40);
}

function verifySensorToken(codigoSensor, token, secret = config.deviceSecret) {
  if (!token || !secret) return false;
  return igualSeguro(sensorToken(codigoSensor, secret), token);
}

// Código numérico de 6 dígitos con un generador criptográfico.
function codigoNumerico() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function sha256(texto) {
  return crypto.createHash('sha256').update(String(texto)).digest('hex');
}

function idAleatorio(prefijo = '', bytes = 8) {
  return prefijo + crypto.randomBytes(bytes).toString('hex').toUpperCase();
}

module.exports = {
  hashPassword, verifyPassword, esHash, signToken, verifyToken,
  sensorToken, verifySensorToken, codigoNumerico, sha256, idAleatorio, igualSeguro,
};
