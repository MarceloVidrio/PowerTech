/* =====================================================================
   PowerTech · Migración v3: administrador del sistema (SUPERADMIN)
   Úsala SOLO si ya tienes una base PowerTech con datos que quieres
   conservar. En una instalación nueva usa powertech.sql (ya lo incluye).
   ===================================================================== */
USE PowerTech;

ALTER TABLE USUARIOS DROP CHECK CK_USUARIOS_Rol;
ALTER TABLE USUARIOS
  ADD COLUMN activo        TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN fechaRegistro DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN ultimoAcceso  DATETIME   NULL,
  ADD CONSTRAINT CK_USUARIOS_Rol CHECK (rol IN ('SUPERADMIN','ADMIN','TECNICO'));

CREATE TABLE IF NOT EXISTS BITACORA_ADMIN (
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
