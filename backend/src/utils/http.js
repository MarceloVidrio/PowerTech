// Errores HTTP y manejador central. El cliente solo recibe mensajes
// genéricos; el detalle técnico se queda en el registro del servidor.
class HttpError extends Error {
  constructor(status, mensaje, detalles) {
    super(mensaje);
    this.status = status;
    this.detalles = detalles;
  }
}

const badRequest = (mensaje, detalles) => new HttpError(400, mensaje, detalles);
const unauthorized = (mensaje = 'Sesión no válida o expirada') => new HttpError(401, mensaje);
const forbidden = (mensaje = 'No tienes permiso para realizar esta acción') => new HttpError(403, mensaje);
const notFound = (mensaje = 'Recurso no encontrado') => new HttpError(404, mensaje);
const conflict = (mensaje) => new HttpError(409, mensaje);

// Traduce errores conocidos de MySQL a respuestas comprensibles.
function traducirMySQL(err) {
  switch (err && err.code) {
    case 'ER_DUP_ENTRY': return conflict('El registro ya existe');
    case 'ER_NO_REFERENCED_ROW_2':
    case 'ER_NO_REFERENCED_ROW': return badRequest('Se hace referencia a un registro que no existe');
    case 'ER_ROW_IS_REFERENCED_2':
    case 'ER_ROW_IS_REFERENCED': return conflict('El registro está en uso y no se puede eliminar');
    case 'ER_CHECK_CONSTRAINT_VIOLATED': return badRequest('Algún dato no cumple las reglas permitidas');
    case 'ER_DATA_TOO_LONG': return badRequest('Algún dato excede la longitud permitida');
    case 'ER_TRUNCATED_WRONG_VALUE':
    case 'ER_WRONG_VALUE': return badRequest('Algún dato tiene un formato incorrecto');
    default: return null;
  }
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let e = err instanceof HttpError ? err : traducirMySQL(err);
  if (!e) {
    if (err && err.type === 'entity.parse.failed') e = badRequest('El cuerpo de la petición no es JSON válido');
    else if (err && err.type === 'entity.too.large') e = new HttpError(413, 'La petición es demasiado grande');
  }
  if (!e) {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, err);
    return res.status(500).json({ error: true, mensaje: 'Ocurrió un error interno. Intenta de nuevo más tarde.' });
  }
  if (e.status >= 500) console.error(err);
  const body = { error: true, mensaje: e.message };
  if (e.detalles) body.detalles = e.detalles;
  res.status(e.status).json(body);
}

const ok = (res, data, mensaje, status = 200) => res.status(status).json({ error: false, data, mensaje });

module.exports = { HttpError, badRequest, unauthorized, forbidden, notFound, conflict, errorHandler, ok, traducirMySQL };
