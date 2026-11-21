// Limitador de intentos en memoria (sin dependencias).
// Suficiente para un solo servidor; con varios servidores habría que usar Redis.
const { HttpError } = require('../utils/http');

// Todos los limitadores creados, para que el administrador pueda desbloquear un correo.
const limitadores = [];

function rateLimit({ ventanaMs = 15 * 60 * 1000, max = 10, clave = (req) => req.ip, mensaje } = {}) {
  const registros = new Map();
  const limpiar = setInterval(() => {
    const ahora = Date.now();
    for (const [k, r] of registros) if (r.reinicio <= ahora) registros.delete(k);
  }, ventanaMs);
  limpiar.unref();

  const mw = (req, res, next) => {
    const k = clave(req);
    const ahora = Date.now();
    let r = registros.get(k);
    if (!r || r.reinicio <= ahora) {
      r = { cuenta: 0, reinicio: ahora + ventanaMs };
      registros.set(k, r);
    }
    r.cuenta++;
    if (r.cuenta > max) {
      res.set('Retry-After', String(Math.ceil((r.reinicio - ahora) / 1000)));
      return next(new HttpError(429, mensaje || 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'));
    }
    next();
  };
  mw.reiniciar = () => registros.clear();
  mw.registros = registros;
  mw.max = max;
  limitadores.push(mw);
  return mw;
}

const correoDe = (req) => `${req.ip}|${String((req.body && req.body.email) || '').trim().toLowerCase()}`;

// Borra los intentos fallidos registrados para un correo (desde cualquier IP).
// Regresa cuántos bloqueos se quitaron.
function desbloquearCorreo(email) {
  const sufijo = `|${String(email || '').trim().toLowerCase()}`;
  let quitados = 0;
  for (const mw of limitadores) {
    for (const k of [...mw.registros.keys()]) {
      if (typeof k === 'string' && k.endsWith(sufijo)) { mw.registros.delete(k); quitados++; }
    }
  }
  return quitados;
}

// ¿Ese correo está bloqueado ahora mismo por demasiados intentos?
function correoBloqueado(email) {
  const sufijo = `|${String(email || '').trim().toLowerCase()}`;
  const ahora = Date.now();
  return limitadores.some((mw) => [...mw.registros].some(([k, r]) =>
    typeof k === 'string' && k.endsWith(sufijo) && r.cuenta > mw.max && r.reinicio > ahora));
}

module.exports = { rateLimit, correoDe, desbloquearCorreo, correoBloqueado };
