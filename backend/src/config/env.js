// Carga y valida la configuración. Ningún secreto vive en el código:
// todo sale de variables de entorno (archivo .env en desarrollo).
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const env = process.env;

const config = {
  port: Number(env.PORT) || 3000,
  nodeEnv: env.NODE_ENV || 'development',
  db: {
    host: env.DB_HOST || 'localhost',
    port: Number(env.DB_PORT) || 3306,
    user: env.DB_USER || 'root',
    password: env.DB_PASSWORD || '',
    database: env.DB_NAME || 'PowerTech',
    ssl: env.DB_SSL === 'true',
    sslCa: env.DB_SSL_CA || path.join(__dirname, 'global-bundle.pem'),
  },
  jwtSecret: env.JWT_SECRET || '',
  jwtHoras: Number(env.JWT_HORAS) || 8,
  deviceSecret: env.DEVICE_SECRET || '',
  corsOrigin: env.CORS_ORIGIN || '',
  appUrl: env.APP_URL || '',
};

// En producción no se arranca sin los secretos obligatorios.
function validar() {
  const faltantes = [];
  if (!config.jwtSecret || config.jwtSecret.length < 32) faltantes.push('JWT_SECRET (mínimo 32 caracteres)');
  if (!config.deviceSecret || config.deviceSecret.length < 32) faltantes.push('DEVICE_SECRET (mínimo 32 caracteres)');
  if (!env.DB_PASSWORD && config.nodeEnv === 'production') faltantes.push('DB_PASSWORD');
  if (faltantes.length) {
    throw new Error(`Faltan variables de entorno: ${faltantes.join(', ')}. Revisa backend/.env.example`);
  }
}

module.exports = { config, validar };
