const express = require('express');
const router = express.Router();
const c = require('../controllers/buildingController');
const { requireAuth, requireRole, sameUserParam } = require('../middleware/auth');

router.use(requireAuth);
router.get('/user/:id', sameUserParam(), c.listarPorUsuario);
router.post('/', requireRole('ADMIN'), c.crear);
router.delete('/:id', requireRole('ADMIN'), c.eliminar);

module.exports = router;
