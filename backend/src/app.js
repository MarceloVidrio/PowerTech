const path = require('path');
const express = require('express');
const cors = require('cors');
const { config, validar } = require('./config/env');
const { probarConexion } = require('./config/connection');
const { errorHandler, notFound } = require('./utils/http');

validar(); // no arranca sin JWT_SECRET ni DEVICE_SECRET

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

// Encabezados de seguridad básicos
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  });
  next();
});

// CORS solo para los orígenes configurados (en producción el frontend se sirve desde el mismo servidor).
app.use(cors({ origin: config.corsOrigin ? config.corsOrigin.split(',').map((s) => s.trim()) : false }));
app.use(express.json({ limit: '100kb' }));

/* Rutas de la API */
app.use('/user', require('./routes/userRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/alarm', require('./routes/alarmRoutes'));
app.use('/api/hogar', require('./routes/hogarRoutes'));
app.use('/api/aparatos', require('./routes/aparatoRoutes'));
app.use('/api/consumo', require('./routes/consumoRoutes'));
app.use('/lecturas', require('./routes/lecturaRoutes'));
app.use('/events', require('./routes/eventsRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));
app.get('/health', (req, res) => res.json({ ok: true }));

/* Frontend compilado (carpeta public en la imagen Docker) */
const distPath = path.join(process.cwd(), 'public');
app.use(express.static(distPath));

// Cualquier otra ruta GET la maneja Vue Router.
app.get(/(.*)/, (req, res, next) => {
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) next(notFound('Ruta no encontrada'));
  });
});
app.use((req, res, next) => next(notFound('Ruta no encontrada')));
app.use(errorHandler);

if (require.main === module) {
  probarConexion();
  require('./services/programador').iniciar(); // apagado automático con enchufes inteligentes
  app.listen(config.port, () => console.log(`Servidor de PowerTech Hogar corriendo en el puerto ${config.port}`));
}

module.exports = app;
