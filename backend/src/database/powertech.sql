/* =====================================================================
   PowerTech Hogar · Script de creación de la base de datos
   MySQL 8 · InnoDB · utf8mb4
   ---------------------------------------------------------------------
   Monitoreo del consumo eléctrico de una casa con un sensor en la pastilla
   principal (p. ej. Sonoff POW Ring) y enchufes inteligentes opcionales.
   ATENCIÓN: borra y vuelve a crear la base PowerTech, SIN usuarios.
   El primer administrador del sistema se crea con "npm run configurar".
   ===================================================================== */
DROP DATABASE IF EXISTS PowerTech;
CREATE DATABASE PowerTech CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE PowerTech;

/* ========================= USUARIOS =========================
   rol: SUPERADMIN (administrador del sistema PowerTech),
        TITULAR    (dueño de la cuenta del hogar: configura todo) o
        FAMILIAR   (miembro de la familia: solo consulta).
   idPropietario: para familiares, el titular del hogar al que pertenecen.
   contrasena: hash scrypt, nunca texto plano.
   activo: una cuenta desactivada no puede iniciar sesión. */
CREATE TABLE USUARIOS (
  idUsuario     INT          NOT NULL AUTO_INCREMENT,
  nombre        VARCHAR(50)  NOT NULL,
  email         VARCHAR(120) NOT NULL,
  contrasena    VARCHAR(255) NOT NULL,
  rol           VARCHAR(10)  NOT NULL DEFAULT 'TITULAR',
  idPropietario INT          NULL,
  activo        TINYINT(1)   NOT NULL DEFAULT 1,
  fechaRegistro DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultimoAcceso  DATETIME     NULL,
  PRIMARY KEY (idUsuario),
  CONSTRAINT UQ_USUARIOS_NombreUsuario UNIQUE (nombre),
  CONSTRAINT UQ_USUARIOS_Email UNIQUE (email),
  CONSTRAINT CK_USUARIOS_Rol CHECK (rol IN ('SUPERADMIN','TITULAR','FAMILIAR')),
  CONSTRAINT FK_USUARIOS_PROPIETARIO FOREIGN KEY (idPropietario)
    REFERENCES USUARIOS (idUsuario) ON DELETE CASCADE
) ENGINE=InnoDB;

/* ========================= HOGARES =========================
   Un hogar por titular.
   tarifa: tarifa doméstica de CFE (1, 1A a 1F; Culiacán es 1F).
   mesInicioVerano: mes en que empieza el verano de la tarifa (dura 6 meses).
   inicioPeriodo: fecha de inicio de un periodo bimestral del recibo; con ella
                  se calcula en qué periodo de facturación va la casa.
   horaDormirInicio/Fin: horas de sueño (pueden cruzar la medianoche).
   consumoBaseW: consumo mínimo "de fondo" (refrigerador, aparatos en espera);
                 en modo vacaciones se avisa si la casa consume más que esto.
   consumoNocheW: consumo normal mientras duermen (incluye el minisplit si lo
                  usan); en horas de sueño se avisa si la casa consume más.
   umbralAltoW: potencia de toda la casa que se considera un pico. */
CREATE TABLE HOGARES (
  idHogar          INT           NOT NULL AUTO_INCREMENT,
  idUsuario        INT           NOT NULL,
  nombre           VARCHAR(80)   NOT NULL DEFAULT 'Mi casa',
  ciudad           VARCHAR(80)   NULL,
  tarifa           VARCHAR(3)    NOT NULL DEFAULT '1F',
  mesInicioVerano  TINYINT       NOT NULL DEFAULT 5,
  inicioPeriodo    DATE          NULL,
  personas         TINYINT       NULL,
  metaBimestralKwh INT           NULL,
  horaDormirInicio TIME          NOT NULL DEFAULT '00:00:00',
  horaDormirFin    TIME          NOT NULL DEFAULT '06:00:00',
  consumoBaseW     DECIMAL(10,2) NOT NULL DEFAULT 300,
  consumoNocheW    DECIMAL(10,2) NOT NULL DEFAULT 1500,
  umbralAltoW      DECIMAL(10,2) NOT NULL DEFAULT 5000,
  modoVacaciones   TINYINT(1)    NOT NULL DEFAULT 0,
  creado           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (idHogar),
  CONSTRAINT UQ_HOGARES_Usuario UNIQUE (idUsuario),
  CONSTRAINT CK_HOGARES_Tarifa CHECK (tarifa IN ('1','1A','1B','1C','1D','1E','1F')),
  CONSTRAINT CK_HOGARES_Mes CHECK (mesInicioVerano BETWEEN 1 AND 12),
  CONSTRAINT CK_HOGARES_Umbrales CHECK (consumoBaseW >= 0 AND consumoNocheW >= consumoBaseW AND umbralAltoW > consumoNocheW),
  CONSTRAINT FK_HOGARES_USUARIOS FOREIGN KEY (idUsuario)
    REFERENCES USUARIOS (idUsuario) ON DELETE CASCADE
) ENGINE=InnoDB;

/* ========================= MEDIDORES =========================
   Sensor de consumo instalado en la pastilla principal (uno por hogar). Mide la
   potencia total de la casa y la envía a POST /lecturas con su token. */
CREATE TABLE MEDIDORES (
  codigoMedidor VARCHAR(20) NOT NULL,
  idHogar       INT         NOT NULL,
  nombre        VARCHAR(80) NOT NULL DEFAULT 'Sensor de consumo',
  modelo        VARCHAR(60) NULL,
  activo        TINYINT(1)  NOT NULL DEFAULT 1,
  instalado     DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (codigoMedidor),
  CONSTRAINT UQ_MEDIDORES_Hogar UNIQUE (idHogar),
  CONSTRAINT FK_MEDIDORES_HOGARES FOREIGN KEY (idHogar)
    REFERENCES HOGARES (idHogar) ON DELETE CASCADE
) ENGINE=InnoDB;

/* ========================= APARATOS =========================
   Inventario de aparatos de la casa. potenciaW y horasDia sirven para
   estimar cuánto consume cada uno (el medidor solo mide el total).
   controlUrl: enchufe inteligente opcional (p. ej. con Tasmota) para
   apagarlo a distancia; apagarAlDormir/apagarEnVacaciones lo apagan solo. */
CREATE TABLE APARATOS (
  idAparato          INT           NOT NULL AUTO_INCREMENT,
  idHogar            INT           NOT NULL,
  nombre             VARCHAR(80)   NOT NULL,
  tipo               VARCHAR(20)   NOT NULL DEFAULT 'OTRO',
  cuarto             VARCHAR(60)   NULL,
  potenciaW          DECIMAL(10,2) NULL,
  horasDia           DECIMAL(4,1)  NULL,
  controlUrl         VARCHAR(255)  NULL,
  apagarAlDormir     TINYINT(1)    NOT NULL DEFAULT 0,
  apagarEnVacaciones TINYINT(1)    NOT NULL DEFAULT 0,
  PRIMARY KEY (idAparato),
  INDEX IX_APARATOS_Hogar (idHogar),
  CONSTRAINT CK_APARATOS_Tipo CHECK (tipo IN ('MINISPLIT','REFRIGERADOR','LAVADORA','SECADORA','TELEVISION',
    'COMPUTADORA','ILUMINACION','BOMBA','CALENTADOR','MICROONDAS','PLANCHA','VENTILADOR','OTRO')),
  CONSTRAINT CK_APARATOS_Horas CHECK (horasDia IS NULL OR horasDia BETWEEN 0 AND 24),
  CONSTRAINT CK_APARATOS_Potencia CHECK (potenciaW IS NULL OR potenciaW >= 0),
  CONSTRAINT FK_APARATOS_HOGARES FOREIGN KEY (idHogar)
    REFERENCES HOGARES (idHogar) ON DELETE CASCADE
) ENGINE=InnoDB;

/* ========================= LECTURAS =========================
   valor = potencia instantánea de toda la casa en W. La PK (medidor, fecha)
   también sirve como índice para las consultas por periodo. */
CREATE TABLE LECTURAS (
  codigoMedidor VARCHAR(20)   NOT NULL,
  fechaHora     DATETIME      NOT NULL,
  valor         DECIMAL(18,4) NOT NULL,
  PRIMARY KEY (codigoMedidor, fechaHora),
  CONSTRAINT CK_LECTURAS_Valor CHECK (valor >= 0),
  CONSTRAINT FK_LECTURAS_MEDIDORES FOREIGN KEY (codigoMedidor)
    REFERENCES MEDIDORES (codigoMedidor) ON DELETE CASCADE
) ENGINE=InnoDB;

/* ========================= ALARMAS =========================
   Avisos del hogar. La lógica vive en el backend (services/alarmRules.js).
   claveActiva = "hogar|tipo" mientras la alarma está ACTIVA y NULL después:
   su índice único garantiza como máximo UNA alarma ACTIVA por hogar y tipo. */
CREATE TABLE ALARMAS (
  codigoAlarma VARCHAR(20)  NOT NULL,
  idHogar      INT          NOT NULL,
  tipoAlarma   VARCHAR(40)  NOT NULL,
  nivel        TINYINT      NOT NULL,
  estado       VARCHAR(15)  NOT NULL,
  fechaHora    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  detalle      VARCHAR(400) NULL,
  claveActiva  VARCHAR(60)  NULL,
  PRIMARY KEY (codigoAlarma),
  CONSTRAINT UQ_ALARMAS_UnaActiva UNIQUE (claveActiva),
  CONSTRAINT CK_ALARMAS_Nivel CHECK (nivel BETWEEN 1 AND 5),
  CONSTRAINT CK_ALARMAS_Estado CHECK (estado IN ('ACTIVA','ATENDIDA','CERRADA')),
  CONSTRAINT FK_ALARMAS_HOGARES FOREIGN KEY (idHogar)
    REFERENCES HOGARES (idHogar) ON DELETE CASCADE,
  INDEX IX_ALARMAS_Hogar_Estado (idHogar, estado)
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
   Registro de lo que hace el administrador del sistema sobre las cuentas.
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
