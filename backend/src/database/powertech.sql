/* =====================================================================
   PowerTech · Script de creación de la base de datos (instalación nueva)
   MySQL 8 · InnoDB · utf8mb4
   ---------------------------------------------------------------------
   ATENCIÓN: borra y vuelve a crear la base PowerTech.
   Para actualizar una base existente SIN perder datos usa migracion_v2.sql
   ===================================================================== */
DROP DATABASE IF EXISTS PowerTech;
CREATE DATABASE PowerTech CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE PowerTech;

/* ========================= USUARIOS =========================
   rol: SUPERADMIN (administrador del sistema PowerTech: ve y corrige a
        todos los usuarios), ADMIN (dueño de la cuenta de una PyME) o
        TECNICO (personal de la PyME).
   idPropietario: para técnicos, el administrador al que pertenecen.
   contrasena: hash scrypt, nunca texto plano.
   activo: una cuenta desactivada no puede iniciar sesión.
   La base se crea SIN usuarios: el primer SUPERADMIN se crea con
   "npm run configurar" (backend/scripts/configurar.js). */
CREATE TABLE USUARIOS (
  idUsuario     INT          NOT NULL AUTO_INCREMENT,
  nombre        VARCHAR(50)  NOT NULL,
  email         VARCHAR(120) NOT NULL,
  contrasena    VARCHAR(255) NOT NULL,
  rol           VARCHAR(10)  NOT NULL DEFAULT 'ADMIN',
  idPropietario INT          NULL,
  activo        TINYINT(1)   NOT NULL DEFAULT 1,
  fechaRegistro DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultimoAcceso  DATETIME     NULL,
  PRIMARY KEY (idUsuario),
  CONSTRAINT UQ_USUARIOS_NombreUsuario UNIQUE (nombre),
  CONSTRAINT UQ_USUARIOS_Email UNIQUE (email),
  CONSTRAINT CK_USUARIOS_Rol CHECK (rol IN ('SUPERADMIN','ADMIN','TECNICO')),
  CONSTRAINT FK_USUARIOS_PROPIETARIO FOREIGN KEY (idPropietario)
    REFERENCES USUARIOS (idUsuario) ON DELETE CASCADE
) ENGINE=InnoDB;

/* ========================= TARIFAS ========================= */
CREATE TABLE TARIFAS (
  codigoTarifa VARCHAR(10) NOT NULL,
  nombre       VARCHAR(60) NOT NULL,
  PRIMARY KEY (codigoTarifa)
) ENGINE=InnoDB;
INSERT INTO TARIFAS VALUES ('GDMTH','Gran demanda en media tensión horaria'),
                           ('GDMTO','Gran demanda en media tensión ordinaria');

/* ========================= EDIFICIOS ========================= */
CREATE TABLE EDIFICIOS (
  codigoEdificio VARCHAR(10)  NOT NULL,
  idUsuario      INT          NOT NULL,
  codigoTarifa   VARCHAR(10)  NULL,
  nombreEdificio VARCHAR(120) NOT NULL,
  horarioEntrada TIME         NOT NULL,
  horarioSalida  TIME         NOT NULL,
  PRIMARY KEY (codigoEdificio),
  CONSTRAINT CK_EDIFICIOS_Horas CHECK (horarioEntrada < horarioSalida),
  CONSTRAINT FK_EDIFICIOS_USUARIOS FOREIGN KEY (idUsuario)
    REFERENCES USUARIOS (idUsuario) ON DELETE CASCADE,
  CONSTRAINT FK_EDIFICIOS_TARIFAS FOREIGN KEY (codigoTarifa)
    REFERENCES TARIFAS (codigoTarifa) ON DELETE SET NULL
) ENGINE=InnoDB;

/* ========================= SALAS ========================= */
CREATE TABLE SALAS (
  codigoSala     VARCHAR(10) NOT NULL,
  codigoEdificio VARCHAR(10) NOT NULL,
  nombreSala     VARCHAR(60) NULL,
  PRIMARY KEY (codigoSala),
  CONSTRAINT FK_SALAS_EDIFICIOS FOREIGN KEY (codigoEdificio)
    REFERENCES EDIFICIOS (codigoEdificio) ON DELETE CASCADE
) ENGINE=InnoDB;

/* ========================= DISPOSITIVOS =========================
   tipo: C = computadora, A = aire acondicionado.
   controlUrl: relevador opcional (p. ej. Sonoff con Tasmota).
   autoApagado: apagar el equipo si consume fuera de horario. */
CREATE TABLE DISPOSITIVOS (
  codigoDispositivo VARCHAR(10)  NOT NULL,
  codigoSala        VARCHAR(10)  NOT NULL,
  nombre            VARCHAR(100) NOT NULL,
  marca             VARCHAR(60)  NULL,
  tipo              CHAR(1)      NOT NULL DEFAULT 'C',
  controlUrl        VARCHAR(255) NULL,
  autoApagado       TINYINT(1)   NOT NULL DEFAULT 0,
  PRIMARY KEY (codigoDispositivo),
  CONSTRAINT CK_DISPOSITIVOS_Tipo CHECK (tipo IN ('C','A')),
  CONSTRAINT FK_DISPOSITIVOS_SALAS FOREIGN KEY (codigoSala)
    REFERENCES SALAS (codigoSala) ON DELETE CASCADE
) ENGINE=InnoDB;

/* ========================= SENSORES =========================
   codigoDispositivo es opcional y único: un sensor mide como máximo un
   dispositivo y queda libre (NULL) si el dispositivo se elimina.
   idUsuario: cuenta dueña del sensor, aunque esté libre. */
CREATE TABLE SENSORES (
  codigoSensor      VARCHAR(10)   NOT NULL,
  idUsuario         INT           NOT NULL,
  codigoDispositivo VARCHAR(10)   NULL,
  nombreSensor      VARCHAR(80)   NOT NULL,
  tipoSensor        VARCHAR(40)   NOT NULL,
  unidadMedida      VARCHAR(20)   NULL,
  umbralBajo        DECIMAL(18,4) NULL,
  umbralAlto        DECIMAL(18,4) NULL,
  activo            TINYINT(1)    NOT NULL DEFAULT 1,
  PRIMARY KEY (codigoSensor),
  CONSTRAINT UQ_SENSORES_Dispositivo UNIQUE (codigoDispositivo),
  CONSTRAINT CK_SENSORES_Umbrales CHECK (umbralBajo IS NULL OR umbralAlto IS NULL OR umbralBajo < umbralAlto),
  CONSTRAINT FK_SENSORES_USUARIOS FOREIGN KEY (idUsuario)
    REFERENCES USUARIOS (idUsuario) ON DELETE CASCADE,
  CONSTRAINT FK_SENSORES_DISPOSITIVOS FOREIGN KEY (codigoDispositivo)
    REFERENCES DISPOSITIVOS (codigoDispositivo) ON DELETE SET NULL
) ENGINE=InnoDB;

/* ========================= LECTURAS =========================
   valor = potencia instantánea en W. La PK (sensor, fecha) también sirve
   como índice para las consultas por periodo. */
CREATE TABLE LECTURAS (
  codigoSensor VARCHAR(10)   NOT NULL,
  fechaHora    DATETIME      NOT NULL,
  valor        DECIMAL(18,4) NOT NULL,
  detalle      VARCHAR(200)  NULL,
  PRIMARY KEY (codigoSensor, fechaHora),
  CONSTRAINT CK_LECTURAS_Valor CHECK (valor >= 0),
  CONSTRAINT FK_LECTURAS_SENSORES FOREIGN KEY (codigoSensor)
    REFERENCES SENSORES (codigoSensor) ON DELETE CASCADE
) ENGINE=InnoDB;

/* ========================= ALARMAS =========================
   La lógica que crea alarmas vive en el backend (services/alarmRules.js).
   claveActiva = "sensor|tipo" mientras la alarma está ACTIVA y NULL después.
   Su índice único garantiza como máximo UNA alarma ACTIVA por sensor y tipo
   (ya no se duplican con cada lectura alta). La mantiene el backend: MySQL no
   permite columnas generadas sobre llaves foráneas con ON DELETE CASCADE. */
CREATE TABLE ALARMAS (
  codigoAlarma   VARCHAR(20)  NOT NULL,
  codigoEdificio VARCHAR(10)  NOT NULL,
  codigoSala     VARCHAR(10)  NOT NULL,
  codigoSensor   VARCHAR(10)  NOT NULL,
  tipoAlarma     VARCHAR(40)  NOT NULL,
  nivel          TINYINT      NOT NULL,
  estado         VARCHAR(15)  NOT NULL,
  fechaHora      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  detalle        VARCHAR(400) NULL,
  claveActiva    VARCHAR(60)  NULL,
  PRIMARY KEY (codigoAlarma),
  CONSTRAINT UQ_ALARMAS_UnaActiva UNIQUE (claveActiva),
  CONSTRAINT CK_ALARMAS_Nivel CHECK (nivel BETWEEN 1 AND 5),
  CONSTRAINT CK_ALARMAS_Estado CHECK (estado IN ('ACTIVA','ATENDIDA','CERRADA')),
  CONSTRAINT FK_ALARMAS_EDIFICIOS FOREIGN KEY (codigoEdificio)
    REFERENCES EDIFICIOS (codigoEdificio) ON DELETE CASCADE,
  CONSTRAINT FK_ALARMAS_SALAS FOREIGN KEY (codigoSala)
    REFERENCES SALAS (codigoSala) ON DELETE CASCADE,
  CONSTRAINT FK_ALARMAS_SENSORES FOREIGN KEY (codigoSensor)
    REFERENCES SENSORES (codigoSensor) ON DELETE CASCADE,
  INDEX IX_ALARMAS_Edificio_Estado (codigoEdificio, estado),
  INDEX IX_ALARMAS_Sala_Estado (codigoSala, estado)
) ENGINE=InnoDB;

/* ========================= RECUPERACION_CONTRASENA =========================
   codigo = SHA-256 del código de 6 dígitos (no se guarda en claro).
   intentos: después de 5 intentos fallidos el código deja de servir. */
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

/* ========================= BITACORA_ADMIN =========================
   Registro de lo que hace el administrador del sistema sobre las cuentas
   (cambios de datos, contraseñas, activaciones, eliminaciones...).
   nombreAfectado se guarda en texto para que el registro siga siendo
   legible aunque la cuenta se elimine. */
CREATE TABLE BITACORA_ADMIN (
  idBitacora     INT          NOT NULL AUTO_INCREMENT,
  idAdmin        INT          NULL,
  idAfectado     INT          NULL,
  nombreAfectado VARCHAR(50)  NULL,
  accion         VARCHAR(40)  NOT NULL,
  detalle        VARCHAR(400) NULL,
  fechaHora      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (idBitacora),
  INDEX IX_BITACORA_Afectado (idAfectado),
  CONSTRAINT FK_BITACORA_ADMIN FOREIGN KEY (idAdmin)
    REFERENCES USUARIOS (idUsuario) ON DELETE SET NULL,
  CONSTRAINT FK_BITACORA_AFECTADO FOREIGN KEY (idAfectado)
    REFERENCES USUARIOS (idUsuario) ON DELETE SET NULL
) ENGINE=InnoDB;

/* ========================= VISTA_REPORTE_SALA =========================
   índice de operatividad = % de dispositivos SIN alarmas activas.
   Cuenta dispositivos distintos, así que siempre queda entre 0 y 100. */
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
