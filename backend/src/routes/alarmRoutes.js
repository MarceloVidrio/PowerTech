const express = require('express');
const router = express.Router();
const c = require('../controllers/alarmController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth);
router.get('/', c.obtenerAlarmas);                                  // titular y familia
router.patch('/:id/estado', requireRole('TITULAR'), c.actualizarEstado);

module.exports = router;
