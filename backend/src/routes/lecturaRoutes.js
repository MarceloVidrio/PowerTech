const express = require('express');
const router = express.Router();
const c = require('../controllers/lecturaController');
const { requireAuth } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');

// POST /lecturas — nodos IoT; se autentican con el encabezado X-Sensor-Token.
router.post('/', rateLimit({ ventanaMs: 60 * 1000, max: 600, clave: (req) => `${req.ip}|${req.body && req.body.codigoSensor}` }), c.crear);
// GET /lecturas/sala/:codigoSala — usuarios con sesión
router.get('/sala/:codigoSala', requireAuth, c.obtenerPorSala);

module.exports = router;
