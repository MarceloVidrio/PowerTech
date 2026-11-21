const express = require('express');
const router = express.Router();
const c = require('../controllers/userController');
const { requireAuth, requireRole, sameUserParam } = require('../middleware/auth');
const { rateLimit, correoDe } = require('../middleware/rateLimit');

// Límites contra ataques de fuerza bruta
const limiteLogin = rateLimit({ max: 10, clave: correoDe, mensaje: 'Demasiados intentos de inicio de sesión. Espera 15 minutos.' });
const limiteRecuperar = rateLimit({ max: 5, clave: correoDe });
const limiteCodigo = rateLimit({ max: 10, clave: correoDe });
const limiteRegistro = rateLimit({ max: 10 });

router.post('/login', limiteLogin, c.login);                  // Iniciar sesión
router.post('/recover', limiteRecuperar, c.recover);          // Solicitar código de recuperación
router.post('/verify-code', limiteCodigo, c.verificarCodigo); // Verificar el código
router.post('/reset-password', limiteCodigo, c.cambiarContrasena);
router.post('/', limiteRegistro, c.crear);                    // Registro de un administrador

// Técnicos de la empresa (solo el administrador)
router.get('/tecnicos', requireAuth, requireRole('ADMIN'), c.listarTecnicos);
router.post('/tecnicos', requireAuth, requireRole('ADMIN'), c.crearTecnico);
router.delete('/tecnicos/:id', requireAuth, requireRole('ADMIN'), c.eliminarTecnico);

router.get('/:id/perfil', requireAuth, sameUserParam(), c.obtenerDatosRelacionados);

module.exports = router;
