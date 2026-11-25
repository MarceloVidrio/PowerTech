// Consumo de la casa y recibo estimado (titular y familia).
const express = require('express');
const router = express.Router();
const c = require('../controllers/consumoController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);
router.get('/fechas', c.fechas);     // meses con lecturas
router.get('/mes', c.mes);           // kWh del mes, gráfica, franjas y pico
router.get('/periodo', c.periodo);   // bimestre actual: consumo, pronóstico, recibo estimado, DAC
router.get('/historial', c.historial); // últimos 6 bimestres
router.get('/aparatos', c.aparatos); // consumo estimado por aparato
router.get('/tarifa', c.tarifaHogar);// tabla de la tarifa CFE del hogar

module.exports = router;
