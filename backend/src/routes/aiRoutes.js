const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');
const { requireAuth } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const { ok, badRequest, HttpError } = require('../utils/http');

const limite = rateLimit({ ventanaMs: 60 * 1000, max: 10, clave: (req) => String(req.user.id), mensaje: 'Estás enviando demasiadas preguntas. Espera un minuto.' });

// POST /api/ai/consejo  { datos: { consulta } }
router.post('/consejo', requireAuth, limite, async (req, res) => {
  const consulta = String((req.body && req.body.datos && req.body.datos.consulta) || '').trim();
  if (!consulta) throw badRequest('No se proporcionó una consulta.');
  if (consulta.length > 1000) throw badRequest('La pregunta es demasiado larga (máximo 1000 caracteres).');
  try {
    const texto = await aiService.obtenerConsejoPowerBot(consulta, req.user.owner);
    res.json({ error: false, mensaje: texto });
  } catch (e) {
    console.error('Error en PowerBot:', e.message);
    throw new HttpError(503, 'PowerBot no está disponible en este momento. Intenta más tarde.');
  }
});

module.exports = router;
