const express = require('express');
const router = express.Router();
const c = require('../controllers/VISTA_REPORTE_SALAController');
const { requireAuth } = require('../middleware/auth');

// GET /report/room/:id — métricas de la vista VISTA_REPORTE_SALA
router.get('/room/:id', requireAuth, c.obtenerReportePorSala);

module.exports = router;
