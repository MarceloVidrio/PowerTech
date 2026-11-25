// Hogar y medidor general. Consultar: titular y familia. Cambiar: solo el titular.
const express = require('express');
const router = express.Router();
const c = require('../controllers/hogarController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth);
router.get('/', c.obtener);
router.put('/', requireRole('TITULAR'), c.guardar);
router.patch('/vacaciones', requireRole('TITULAR'), c.vacaciones);
router.post('/medidor', requireRole('TITULAR'), c.registrarMedidor);
router.patch('/medidor', requireRole('TITULAR'), c.actualizarMedidor);
router.delete('/medidor', requireRole('TITULAR'), c.eliminarMedidor);
router.get('/medidor/token', requireRole('TITULAR'), c.tokenMedidor);

module.exports = router;
