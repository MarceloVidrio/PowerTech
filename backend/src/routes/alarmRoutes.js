const express = require('express');
const router = express.Router();
const c = require('../controllers/alarmController');
const { requireAuth, sameUserParam } = require('../middleware/auth');

router.use(requireAuth);
router.get('/user/:id', sameUserParam(), c.obtenerAlarmasPorUsuario);
router.patch('/:id/estado', c.actualizarEstado);

module.exports = router;
