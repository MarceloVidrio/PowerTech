const express = require('express');
const router = express.Router();
const c = require('../controllers/sensorController');
const { requireAuth, requireRole, sameUserParam } = require('../middleware/auth');

router.use(requireAuth);
router.get('/user/:id', sameUserParam(), c.listarPorUsuario);
router.get('/device/:id', c.listarPorDispositivo);
router.get('/:id/readings', c.obtenerLecturas);
router.get('/:id/token', requireRole('ADMIN'), c.obtenerToken);
router.post('/', requireRole('ADMIN'), c.crear);
router.patch('/:id/estado', c.actualizarEstado);
router.patch('/:id/umbrales', requireRole('ADMIN'), c.actualizarUmbrales);
router.delete('/:id', requireRole('ADMIN'), c.eliminar);

module.exports = router;
