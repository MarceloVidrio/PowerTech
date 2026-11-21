const db = require('../config/db');
const own = require('../services/ownership');
const { ok, notFound } = require('../utils/http');

// GET /report/room/:id
async function obtenerReportePorSala(req, res) {
  await own.sala(req.user.owner, req.params.id);
  const rows = await db.query(`
    SELECT v.*,
      (SELECT COUNT(*) FROM SENSORES s JOIN DISPOSITIVOS d ON s.codigoDispositivo = d.codigoDispositivo
        WHERE d.codigoSala = v.codigoSala) AS total_sensores,
      (SELECT COUNT(*) FROM ALARMAS a WHERE a.codigoSala = v.codigoSala AND a.estado IN ('ATENDIDA','CERRADA'))
        AS alarmas_historicas_resueltas
    FROM VISTA_REPORTE_SALA v
    WHERE v.codigoSala = ?`, [req.params.id]);
  if (!rows.length) throw notFound('No se encontraron datos para la sala especificada');
  ok(res, rows[0], 'Reporte generado con éxito');
}

module.exports = { obtenerReportePorSala };
