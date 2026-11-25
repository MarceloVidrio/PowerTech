// Autenticación y autorización.
//  requireAuth   → exige "Authorization: Bearer <token>", comprueba que la cuenta
//                  siga existiendo y activa, y deja req.user (con el rol actual).
//  requireRole   → limita la ruta a ciertos roles (SUPERADMIN, TITULAR o FAMILIAR).
//  sameUserParam → el :id de la URL debe ser el del usuario autenticado.
const db = require('../config/db');
const { verifyToken } = require('../utils/security');
const { unauthorized, forbidden } = require('../utils/http');

function leerToken(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7).trim();
  return null;
}

async function requireAuth(req, res, next) {
  const payload = verifyToken(leerToken(req));
  if (!payload) return next(unauthorized());
  try {
    // Se consulta la cuenta en cada petición: si el administrador del sistema la
    // desactiva, la elimina o le cambia el rol, el cambio aplica de inmediato.
    const rows = await db.query('SELECT idUsuario, nombre, rol, idPropietario, activo FROM USUARIOS WHERE idUsuario = ?', [Number(payload.sub)]);
    const u = rows[0];
    if (!u) return next(unauthorized());
    if (!u.activo) return next(unauthorized('Tu cuenta está desactivada. Contacta al administrador.'));
    // owner = cuenta dueña de la información del hogar (el titular).
    req.user = { id: u.idUsuario, owner: u.idPropietario || u.idUsuario, rol: u.rol || 'TITULAR', nombre: u.nombre };
    next();
  } catch (e) {
    next(e);
  }
}

const requireRole = (...roles) => (req, res, next) => {
  if (roles.includes(req.user && req.user.rol)) return next();
  // A un familiar se le explica por qué no puede hacer cambios
  next(forbidden(req.user && req.user.rol === 'FAMILIAR'
    ? 'Solo el titular del hogar puede hacer cambios; tu cuenta es de consulta.'
    : undefined));
};

function sameUserParam(param = 'id') {
  return (req, res, next) => {
    const id = Number(req.params[param]);
    if (!req.user || id !== req.user.id) return next(forbidden());
    next();
  };
}

module.exports = { requireAuth, requireRole, sameUserParam, leerToken };
