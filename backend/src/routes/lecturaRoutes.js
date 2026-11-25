const express = require('express');
const router = express.Router();
const c = require('../controllers/lecturaController');
const { requireAuth } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');

// POST /lecturas — medidor general; se autentica con el encabezado X-Sensor-Token.
router.post('/', rateLimit({ ventanaMs: 60 * 1000, max: 3000, clave: (req) => `${req.ip}|${req.body && (req.body.codigoMedidor || req.body.codigoSensor)}` }), c.crear);
// GET /lecturas/recientes?horas=24 — potencia de las últimas horas (titular y familia)
router.get('/recientes', requireAuth, c.recientes);

module.exports = router;
