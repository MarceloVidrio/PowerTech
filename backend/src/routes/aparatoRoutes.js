// Aparatos de la casa. Consultar: titular y familia. Cambiar o apagar: solo el titular.
const express = require('express');
const router = express.Router();
const c = require('../controllers/aparatoController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth);
router.get('/', c.listar);
router.post('/', requireRole('TITULAR'), c.crear);
router.put('/:id', requireRole('TITULAR'), c.actualizar);
router.delete('/:id', requireRole('TITULAR'), c.eliminar);
router.post('/:id/power', requireRole('TITULAR'), c.encenderApagar);

module.exports = router;
