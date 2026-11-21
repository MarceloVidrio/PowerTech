const express = require('express');
const router = express.Router();
const c = require('../controllers/roomController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth);
router.get('/building/:id', c.listarPorEdificio);
router.post('/', requireRole('ADMIN'), c.crear);
router.delete('/:id', requireRole('ADMIN'), c.eliminar);

module.exports = router;
