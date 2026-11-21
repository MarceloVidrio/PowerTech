// Ayudante único para consultar MySQL con promesas.
// Las pruebas pueden reemplazar db.query por una función falsa.
const { getPool } = require('./connection');

const db = {
  async query(sql, params = []) {
    const [rows] = await getPool().promise().query(sql, params);
    return rows;
  },
  // Ejecuta varias operaciones en una transacción.
  async transaction(fn) {
    const conn = await getPool().promise().getConnection();
    try {
      await conn.beginTransaction();
      const q = async (sql, params = []) => (await conn.query(sql, params))[0];
      const result = await fn(q);
      await conn.commit();
      return result;
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  },
};

module.exports = db;
