// Pool de conexiones a MySQL configurado solo con variables de entorno.
// Se crea al primer uso para que las pruebas no necesiten una base de datos.
const fs = require('fs');
const { config } = require('./env');

let pool = null;

function getPool() {
  if (pool) return pool;
  const mysql = require('mysql2');
  const opciones = {
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  };
  if (config.db.ssl) {
    opciones.ssl = { ca: fs.readFileSync(config.db.sslCa), rejectUnauthorized: true };
  }
  pool = mysql.createPool(opciones);
  return pool;
}

function probarConexion() {
  getPool().getConnection((error, conn) => {
    if (error) {
      console.error('No se pudo conectar con MySQL:', error.code || error.message);
    } else {
      console.log(`Base de datos ${config.db.database} conectada en ${config.db.host}:${config.db.port}`);
      conn.release();
    }
  });
}

module.exports = { getPool, probarConexion };
