// Panel del administrador del sistema (/api/admin): todas las rutas exigen rol SUPERADMIN.
const express = require('express');
const router = express.Router();
const c = require('../controllers/adminController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth, requireRole('SUPERADMIN'));

router.get('/resumen', c.resumen);
router.get('/bitacora', c.bitacora);
router.get('/titulares', c.listarTitulares);

router.get('/usuarios', c.listarUsuarios);
router.post('/usuarios', c.crearUsuario);
router.get('/usuarios/:id', c.detalleUsuario);
router.patch('/usuarios/:id', c.actualizarUsuario);
router.delete('/usuarios/:id', c.eliminarUsuario);
router.post('/usuarios/:id/contrasena', c.restablecerContrasena);
router.post('/usuarios/:id/desbloquear', c.desbloquear);

router.patch('/medidores/:codigo', c.cambiarMedidor);
router.post('/alarmas/:codigo/cerrar', c.cerrarAlarma);

module.exports = router;
