// Validaciones reutilizables que regresan una lista de errores.
const texto = (v) => typeof v === 'string' ? v.trim() : '';

function requerido(errores, valor, nombre, max) {
  const t = texto(valor);
  if (!t) errores.push(`${nombre} es obligatorio`);
  else if (max && t.length > max) errores.push(`${nombre} no debe superar ${max} caracteres`);
  return t;
}

function opcional(errores, valor, nombre, max) {
  if (valor === undefined || valor === null || valor === '') return null;
  const t = texto(String(valor));
  if (max && t.length > max) errores.push(`${nombre} no debe superar ${max} caracteres`);
  return t;
}

function numeroOpcional(errores, valor, nombre) {
  if (valor === undefined || valor === null || valor === '') return null;
  const n = Number(valor);
  if (!Number.isFinite(n)) { errores.push(`${nombre} debe ser un número`); return null; }
  return n;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const FECHA_RE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/;

function contrasenaSegura(errores, valor, nombre = 'La contraseña') {
  const t = typeof valor === 'string' ? valor : '';
  if (t.length < 8) errores.push(`${nombre} debe tener al menos 8 caracteres`);
  else if (t.length > 128) errores.push(`${nombre} es demasiado larga`);
  else if (!/[A-Za-z]/.test(t) || !/\d/.test(t)) errores.push(`${nombre} debe incluir letras y números`);
  return t;
}

module.exports = { texto, requerido, opcional, numeroOpcional, contrasenaSegura, EMAIL_RE, HORA_RE, FECHA_RE };
