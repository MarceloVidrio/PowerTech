const express = require('express');
const router = express.Router();
const c = require('../controllers/deviceController');
const { requireAuth, requireRole, sameUserParam } = require('../middleware/auth');

router.use(requireAuth);
router.get('/room/:id', c.listarPorSala);
router.get('/room/:id/available-sensors', c.listarSensoresLibres);
router.get('/user/:id', sameUserParam(), c.listarPorUsuario);
router.post('/', requireRole('ADMIN'), c.crear);
router.patch('/:id/sensor', requireRole('ADMIN'), c.asignarSensor);
router.patch('/:id/control', requireRole('ADMIN'), c.configurarControl);
router.post('/:id/power', c.encenderApagar); // técnicos también pueden encender o apagar
router.delete('/:id', requireRole('ADMIN'), c.eliminar);

module.exports = router;
