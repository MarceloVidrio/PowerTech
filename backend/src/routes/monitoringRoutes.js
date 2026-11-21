const express = require('express');
const router = express.Router();
const m = require('../controllers/monitoringdata');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);
router.get('/fechas-disponibles/:id', m.obtenerFechasDisponibles); // meses con lecturas
router.get('/general/:id', m.obtenerMonitoreoMensual);             // kWh del periodo
router.get('/devices/:id', m.obtenerDesgloseDispositivos);         // kWh por dispositivo
router.get('/chart/:id', m.obtenerHistorialGrafica);               // datos de la gráfica
router.get('/forecast/:id', m.obtenerPronostico);                  // proyección del mes

module.exports = router;
