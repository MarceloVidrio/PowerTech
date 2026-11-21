/* =====================================================================
   PowerTech · Optimización de LECTURAS para cuando crezca la tabla
   ---------------------------------------------------------------------
   Un sensor que reporta cada minuto genera ~43,000 filas al mes.
   Este script es OPCIONAL. Aplícalo cuando LECTURAS supere ~5 millones de filas.
   ===================================================================== */
USE PowerTech;

/* ---------- Parte A: resumen diario (recomendado desde ya) ----------
   Guarda el consumo de cada sensor por día para que los reportes de meses
   anteriores no tengan que recorrer todas las lecturas. */
CREATE TABLE IF NOT EXISTS CONSUMO_DIARIO (
  codigoSensor VARCHAR(10)   NOT NULL,
  dia          DATE          NOT NULL,
  kwh          DECIMAL(18,4) NOT NULL,
  potenciaMax  DECIMAL(18,4) NOT NULL,
  lecturas     INT           NOT NULL,
  PRIMARY KEY (codigoSensor, dia),
  CONSTRAINT FK_CONSUMO_SENSORES FOREIGN KEY (codigoSensor)
    REFERENCES SENSORES (codigoSensor) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Calcula (o recalcula) el resumen de un día. Huecos de más de 15 min no cuentan.
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS sp_resumir_dia(IN p_dia DATE)
BEGIN
  REPLACE INTO CONSUMO_DIARIO (codigoSensor, dia, kwh, potenciaMax, lecturas)
  SELECT codigoSensor, p_dia,
         SUM(CASE WHEN previa IS NULL OR TIMESTAMPDIFF(SECOND, previa, fechaHora) > 900 THEN 0
                  ELSE (valorPrevio + valor) / 2 * TIMESTAMPDIFF(SECOND, previa, fechaHora) / 3600000 END),
         MAX(valor), COUNT(*)
  FROM (
    SELECT codigoSensor, fechaHora, valor,
           LAG(fechaHora) OVER (PARTITION BY codigoSensor ORDER BY fechaHora) AS previa,
           LAG(valor)     OVER (PARTITION BY codigoSensor ORDER BY fechaHora) AS valorPrevio
    FROM LECTURAS
    WHERE fechaHora >= p_dia AND fechaHora < p_dia + INTERVAL 1 DAY
  ) t
  GROUP BY codigoSensor;
END //
DELIMITER ;

-- Ejecuta el resumen del día anterior todos los días a la 01:00.
-- Requiere: SET GLOBAL event_scheduler = ON;
CREATE EVENT IF NOT EXISTS ev_resumen_diario
  ON SCHEDULE EVERY 1 DAY STARTS (CURRENT_DATE + INTERVAL 1 DAY + INTERVAL 1 HOUR)
  DO CALL sp_resumir_dia(CURRENT_DATE - INTERVAL 1 DAY);

/* ---------- Parte B: particionar LECTURAS por mes (opcional) ----------
   MySQL no permite llaves foráneas en tablas particionadas, así que primero
   se quita FK_LECTURAS_SENSORES. Sin esa llave, las lecturas de un sensor
   eliminado ya no se borran solas; ejecuta periódicamente:
     DELETE FROM LECTURAS WHERE codigoSensor NOT IN (SELECT codigoSensor FROM SENSORES);
   de forma periódica. Descomenta para aplicar:

ALTER TABLE LECTURAS DROP FOREIGN KEY FK_LECTURAS_SENSORES;
ALTER TABLE LECTURAS PARTITION BY RANGE COLUMNS (fechaHora) (
  PARTITION p2026_10 VALUES LESS THAN ('2026-11-01'),
  PARTITION p2026_11 VALUES LESS THAN ('2026-12-01'),
  PARTITION p2026_12 VALUES LESS THAN ('2027-01-01'),
  PARTITION pfuturo  VALUES LESS THAN (MAXVALUE)
);
-- Cada mes: separar la partición futura y borrar meses de más de un año, p. ej.:
-- ALTER TABLE LECTURAS REORGANIZE PARTITION pfuturo INTO (
--   PARTITION p2027_01 VALUES LESS THAN ('2027-02-01'), PARTITION pfuturo VALUES LESS THAN (MAXVALUE));
-- ALTER TABLE LECTURAS DROP PARTITION p2025_11;
*/
