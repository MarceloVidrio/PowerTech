/* =====================================================================
   PowerTech · Migración a la versión 2 (conserva todos los datos)
   ---------------------------------------------------------------------
   1. Haz un respaldo antes:   mysqldump -u root -p PowerTech > respaldo.sql
   2. Ejecuta este script UNA sola vez sobre la base existente.
   Las contraseñas en texto plano se convierten a hash automáticamente
   la próxima vez que cada usuario inicie sesión.
   ===================================================================== */
USE PowerTech;

-- 1. USUARIOS: roles y técnicos
ALTER TABLE USUARIOS
  ADD COLUMN rol VARCHAR(10) NOT NULL DEFAULT 'ADMIN',
  ADD COLUMN idPropietario INT NULL,
  ADD CONSTRAINT CK_USUARIOS_Rol CHECK (rol IN ('ADMIN','TECNICO')),
  ADD CONSTRAINT FK_USUARIOS_PROPIETARIO FOREIGN KEY (idPropietario)
    REFERENCES USUARIOS (idUsuario) ON DELETE CASCADE;

-- 2. TARIFAS y tarifa de cada edificio
CREATE TABLE IF NOT EXISTS TARIFAS (
  codigoTarifa VARCHAR(10) NOT NULL,
  nombre       VARCHAR(60) NOT NULL,
  PRIMARY KEY (codigoTarifa)
) ENGINE=InnoDB;
INSERT IGNORE INTO TARIFAS VALUES ('GDMTH','Gran demanda en media tensión horaria'),
                                  ('GDMTO','Gran demanda en media tensión ordinaria');
ALTER TABLE EDIFICIOS
  ADD COLUMN codigoTarifa VARCHAR(10) NULL AFTER idUsuario,
  ADD CONSTRAINT FK_EDIFICIOS_TARIFAS FOREIGN KEY (codigoTarifa)
    REFERENCES TARIFAS (codigoTarifa) ON DELETE SET NULL;

-- 3. DISPOSITIVOS: relevador y apagado automático
ALTER TABLE DISPOSITIVOS
  MODIFY tipo CHAR(1) NOT NULL DEFAULT 'C',
  ADD COLUMN controlUrl VARCHAR(255) NULL,
  ADD COLUMN autoApagado TINYINT(1) NOT NULL DEFAULT 0;
-- Antes todos se guardaban como 'C'. Se corrigen los que por su nombre son aires;
-- revisa el resultado y ajusta a mano los que falten.
UPDATE DISPOSITIVOS SET tipo = 'A'
WHERE LOWER(nombre) LIKE '%aire%' OR LOWER(nombre) LIKE '%clima%' OR LOWER(nombre) LIKE '%minisplit%';

-- 4. SENSORES: dueño, dispositivo opcional y relación 1 a 1
ALTER TABLE SENSORES ADD COLUMN idUsuario INT NULL AFTER codigoSensor;
UPDATE SENSORES s
  JOIN DISPOSITIVOS d ON d.codigoDispositivo = s.codigoDispositivo
  JOIN SALAS sa ON sa.codigoSala = d.codigoSala
  JOIN EDIFICIOS e ON e.codigoEdificio = sa.codigoEdificio
SET s.idUsuario = e.idUsuario;
ALTER TABLE SENSORES
  MODIFY idUsuario INT NOT NULL,
  ADD CONSTRAINT FK_SENSORES_USUARIOS FOREIGN KEY (idUsuario)
    REFERENCES USUARIOS (idUsuario) ON DELETE CASCADE;

ALTER TABLE SENSORES DROP FOREIGN KEY FK_SENSORES_DISPOSITIVOS;
ALTER TABLE SENSORES MODIFY codigoDispositivo VARCHAR(10) NULL;
-- Si algún dispositivo tenía varios sensores, se queda con el primero y los demás quedan libres.
UPDATE SENSORES s
  JOIN (SELECT codigoDispositivo, MIN(codigoSensor) AS conservar
        FROM SENSORES GROUP BY codigoDispositivo HAVING COUNT(*) > 1) k
    ON k.codigoDispositivo = s.codigoDispositivo AND s.codigoSensor <> k.conservar
SET s.codigoDispositivo = NULL;
ALTER TABLE SENSORES
  ADD CONSTRAINT UQ_SENSORES_Dispositivo UNIQUE (codigoDispositivo),
  ADD CONSTRAINT FK_SENSORES_DISPOSITIVOS FOREIGN KEY (codigoDispositivo)
    REFERENCES DISPOSITIVOS (codigoDispositivo) ON DELETE SET NULL;

-- 5. ALARMAS: ya no las crea un trigger, sino el backend; una activa por sensor y tipo
DROP TRIGGER IF EXISTS trg_lectura_alta_alarma;

ALTER TABLE ALARMAS
  DROP FOREIGN KEY FK_ALARMAS_EDIFICIOS,
  DROP FOREIGN KEY FK_ALARMAS_SALAS,
  DROP FOREIGN KEY FK_ALARMAS_SENSORES;
ALTER TABLE ALARMAS
  MODIFY codigoAlarma VARCHAR(20) NOT NULL,
  MODIFY fechaHora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD CONSTRAINT FK_ALARMAS_EDIFICIOS FOREIGN KEY (codigoEdificio)
    REFERENCES EDIFICIOS (codigoEdificio) ON DELETE CASCADE,
  ADD CONSTRAINT FK_ALARMAS_SALAS FOREIGN KEY (codigoSala)
    REFERENCES SALAS (codigoSala) ON DELETE CASCADE,
  ADD CONSTRAINT FK_ALARMAS_SENSORES FOREIGN KEY (codigoSensor)
    REFERENCES SENSORES (codigoSensor) ON DELETE CASCADE;

-- Las alarmas activas duplicadas (una por cada lectura alta) se cierran,
-- dejando solo la más reciente de cada sensor y tipo.
UPDATE ALARMAS a
  JOIN (SELECT codigoSensor, tipoAlarma, MAX(fechaHora) AS ultima
        FROM ALARMAS WHERE estado = 'ACTIVA' GROUP BY codigoSensor, tipoAlarma) u
    ON u.codigoSensor = a.codigoSensor AND u.tipoAlarma = a.tipoAlarma
SET a.estado = 'CERRADA'
WHERE a.estado = 'ACTIVA' AND a.fechaHora < u.ultima;
-- Si quedaron empates en la misma fecha, se conserva el código menor.
UPDATE ALARMAS a
  JOIN (SELECT codigoSensor, tipoAlarma, MIN(codigoAlarma) AS conservar
        FROM ALARMAS WHERE estado = 'ACTIVA' GROUP BY codigoSensor, tipoAlarma HAVING COUNT(*) > 1) k
    ON k.codigoSensor = a.codigoSensor AND k.tipoAlarma = a.tipoAlarma
SET a.estado = 'CERRADA'
WHERE a.estado = 'ACTIVA' AND a.codigoAlarma <> k.conservar;

ALTER TABLE ALARMAS ADD COLUMN claveActiva VARCHAR(60) NULL;
UPDATE ALARMAS SET claveActiva = CONCAT(codigoSensor, '|', tipoAlarma) WHERE estado = 'ACTIVA';
ALTER TABLE ALARMAS
  ADD CONSTRAINT UQ_ALARMAS_UnaActiva UNIQUE (claveActiva),
  ADD INDEX IX_ALARMAS_Edificio_Estado (codigoEdificio, estado),
  ADD INDEX IX_ALARMAS_Sala_Estado (codigoSala, estado);

-- 6. RECUPERACION_CONTRASENA (faltaba en el script original).
-- Los códigos son temporales, así que se puede recrear sin perder nada importante.
DROP TABLE IF EXISTS RECUPERACION_CONTRASENA;
CREATE TABLE RECUPERACION_CONTRASENA (
  idRecuperacion  INT        NOT NULL AUTO_INCREMENT,
  idUsuario       INT        NOT NULL,
  codigo          CHAR(64)   NOT NULL,
  fechaExpiracion DATETIME   NOT NULL,
  usado           TINYINT(1) NOT NULL DEFAULT 0,
  intentos        TINYINT    NOT NULL DEFAULT 0,
  creado          DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (idRecuperacion),
  INDEX IX_RECUPERACION_Usuario (idUsuario, usado),
  CONSTRAINT FK_RECUPERACION_USUARIOS FOREIGN KEY (idUsuario)
    REFERENCES USUARIOS (idUsuario) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 7. Vista de reporte corregida (el índice ya no puede ser negativo)
DROP VIEW IF EXISTS VISTA_REPORTE_SALA;
CREATE VIEW VISTA_REPORTE_SALA AS
SELECT
  S.codigoSala,
  S.nombreSala,
  E.codigoEdificio,
  E.nombreEdificio,
  ROUND(IFNULL(100 * (1 - COUNT(DISTINCT CASE WHEN A.codigoAlarma IS NOT NULL THEN D.codigoDispositivo END)
                          / NULLIF(COUNT(DISTINCT D.codigoDispositivo), 0)), 100), 2) AS indice_operatividad,
  COUNT(DISTINCT D.codigoDispositivo) AS total_dispositivos,
  COUNT(DISTINCT A.codigoAlarma) AS alarmas_activas,
  COUNT(DISTINCT CASE WHEN A.codigoAlarma IS NOT NULL THEN D.codigoDispositivo END) AS dispositivos_con_alarma,
  COUNT(DISTINCT CASE WHEN D.tipo = 'C' THEN D.codigoDispositivo END) AS cant_computadoras,
  COUNT(DISTINCT CASE WHEN D.tipo = 'A' THEN D.codigoDispositivo END) AS cant_aires
FROM SALAS S
JOIN EDIFICIOS E ON S.codigoEdificio = E.codigoEdificio
LEFT JOIN DISPOSITIVOS D ON D.codigoSala = S.codigoSala
LEFT JOIN SENSORES SE ON SE.codigoDispositivo = D.codigoDispositivo
LEFT JOIN ALARMAS A ON A.codigoSensor = SE.codigoSensor AND A.estado = 'ACTIVA'
GROUP BY S.codigoSala, S.nombreSala, E.codigoEdificio, E.nombreEdificio;
