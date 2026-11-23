-- Esquema PostgreSQL basado en el diagrama de clases (docs/06-diagramas.md).
-- Responsable: Cristina (módulo Datos y alertas). Se ejecuta al crear el contenedor de postgres.
-- Convención: tablas y columnas en snake_case, sin tildes.

CREATE TYPE tipo_trabajo AS ENUM ('POA', 'REC', 'INICIATIVA', 'INCIDENTE');
CREATE TYPE etapa AS ENUM ('ANALISIS', 'DESARROLLO', 'CERTIFICACION', 'DESPLIEGUE', 'ESTABILIZACION');

-- ---------- Usuario web y seguridad ----------
CREATE TABLE rol (
  id            SMALLSERIAL PRIMARY KEY,
  clave         VARCHAR(20) NOT NULL UNIQUE,          -- PMO, TECNICO, ADMINISTRATIVO, ADMINISTRADOR_TI
  nombre        VARCHAR(30) NOT NULL UNIQUE,          -- PMO, Técnico, Administrativo, Administrador TI
  permisos      TEXT[] NOT NULL DEFAULT '{}',
  solo_propios  BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE desarrollador (
  id              VARCHAR(20) PRIMARY KEY,
  nombre          VARCHAR(120) NOT NULL,
  correo          VARCHAR(160) UNIQUE,
  usuario_gitlab  VARCHAR(80) UNIQUE,
  id_redmine      INTEGER UNIQUE,
  usuario_glpi    VARCHAR(80) UNIQUE
);

CREATE TABLE usuario (
  id                VARCHAR(40) PRIMARY KEY,
  nombre            VARCHAR(120) NOT NULL,
  correo            VARCHAR(160) NOT NULL UNIQUE,
  id_sso            VARCHAR(120) NOT NULL UNIQUE,      -- No se guardan contraseñas: la autenticación es del SSO.
  rol_id            SMALLINT NOT NULL REFERENCES rol(id),
  desarrollador_id  VARCHAR(20) REFERENCES desarrollador(id)  -- Para el rol Técnico.
);

CREATE TABLE sesion (
  token_hash  CHAR(64) PRIMARY KEY,                     -- Se guarda el hash, nunca el token.
  usuario_id  VARCHAR(40) NOT NULL REFERENCES usuario(id),
  inicio      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira      TIMESTAMPTZ NOT NULL,
  cerrada     BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE reporte (
  id                  BIGSERIAL PRIMARY KEY,
  usuario_id          VARCHAR(40) NOT NULL REFERENCES usuario(id),
  formato             VARCHAR(5) NOT NULL CHECK (formato IN ('xlsx', 'pdf')),
  filtro              JSONB NOT NULL DEFAULT '{}',        -- Filtro usado (desarrollador, tipo, proyecto, módulo, fechas).
  generado_en         TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_ultima_sync   TIMESTAMPTZ
);

-- ---------- Integración ----------
CREATE TABLE fuente (
  id       SMALLSERIAL PRIMARY KEY,
  nombre   VARCHAR(30) NOT NULL UNIQUE,                 -- redmine, gitlab, glpi, rocketchat
  url_api  VARCHAR(255),                                -- Las credenciales van en variables de entorno, no aquí.
  activa   BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE snapshot_fuente (
  fuente_id  SMALLINT PRIMARY KEY REFERENCES fuente(id),
  datos      JSONB NOT NULL CHECK (jsonb_typeof(datos) = 'array'),
  fecha      TIMESTAMPTZ NOT NULL,
  cursor     TIMESTAMPTZ,
  metadatos  JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(metadatos) = 'array')
);

CREATE TABLE sincronizacion (
  id      BIGSERIAL PRIMARY KEY,
  inicio  TIMESTAMPTZ NOT NULL,
  fin     TIMESTAMPTZ,
  estado  VARCHAR(20) NOT NULL CHECK (estado IN ('en-curso', 'ok', 'parcial', 'fallida'))
);

CREATE TABLE registro_fallo (
  id                 BIGSERIAL PRIMARY KEY,
  sincronizacion_id  BIGINT NOT NULL REFERENCES sincronizacion(id),
  fuente_id          SMALLINT NOT NULL REFERENCES fuente(id),
  fecha              TIMESTAMPTZ NOT NULL DEFAULT now(),
  intentos           SMALLINT NOT NULL,
  mensaje            TEXT NOT NULL
);

-- ---------- Datos y alertas ----------
CREATE TABLE proyecto (
  codigo  VARCHAR(60) PRIMARY KEY,
  nombre  VARCHAR(160) NOT NULL
);

CREATE TABLE modulo_core (
  id      SMALLSERIAL PRIMARY KEY,
  nombre  VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE peticion (
  codigo            VARCHAR(40) PRIMARY KEY,            -- POA-2026-001, REC-2026-014, iniciativa.ti.001, INC-2026-031
  titulo            VARCHAR(255) NOT NULL,
  tipo              tipo_trabajo NOT NULL,
  etapa             etapa NOT NULL,
  estado            VARCHAR(10) NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta', 'cerrada')),
  desarrollador_id  VARCHAR(20) REFERENCES desarrollador(id),
  proyecto_codigo   VARCHAR(60) REFERENCES proyecto(codigo),
  fecha_inicio      DATE,
  fecha_fin         DATE,
  id_redmine        INTEGER UNIQUE,
  id_glpi           INTEGER UNIQUE,
  actualizado_en    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- El avance no se guarda: se calcula desde la etapa (propuesta pendiente de validar con la cooperativa).

CREATE TABLE peticion_modulo (
  peticion_codigo  VARCHAR(40) NOT NULL REFERENCES peticion(codigo) ON DELETE CASCADE,
  modulo_id        SMALLINT NOT NULL REFERENCES modulo_core(id),
  PRIMARY KEY (peticion_codigo, modulo_id)
);

CREATE TABLE actividad_codigo (
  id                BIGSERIAL PRIMARY KEY,
  peticion_codigo   VARCHAR(40) NOT NULL REFERENCES peticion(codigo) ON DELETE CASCADE,
  desarrollador_id  VARCHAR(20) REFERENCES desarrollador(id),
  tipo              VARCHAR(20) NOT NULL CHECK (tipo IN ('commit', 'merge_request', 'pipeline')),
  rama              VARCHAR(255) NOT NULL,
  id_origen         VARCHAR(80) NOT NULL,               -- SHA del commit o id del MR/pipeline en GitLab.
  estado            VARCHAR(30),
  fecha             TIMESTAMPTZ NOT NULL,
  UNIQUE (tipo, id_origen)                              -- Evita duplicados en el upsert.
);

CREATE TABLE indicador_carga (
  id                   BIGSERIAL PRIMARY KEY,
  desarrollador_id     VARCHAR(20) NOT NULL REFERENCES desarrollador(id),
  sincronizacion_id    BIGINT REFERENCES sincronizacion(id),
  peticiones_abiertas  INTEGER NOT NULL,
  avance_promedio      SMALLINT NOT NULL CHECK (avance_promedio BETWEEN 0 AND 100),
  calculado_en         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE umbral (
  id               SMALLSERIAL PRIMARY KEY,
  max_peticiones   INTEGER NOT NULL CHECK (max_peticiones > 0),
  vigente_desde    TIMESTAMPTZ NOT NULL DEFAULT now(),
  configurado_por  VARCHAR(40) REFERENCES usuario(id)
);

CREATE TABLE alerta (
  id                   BIGSERIAL PRIMARY KEY,
  indicador_carga_id   BIGINT NOT NULL REFERENCES indicador_carga(id),
  mensaje              TEXT NOT NULL,
  peticiones_abiertas  INTEGER NOT NULL,
  umbral               INTEGER NOT NULL,                -- max_peticiones vigente al generar la Alerta.
  fecha                TIMESTAMPTZ NOT NULL DEFAULT now(),
  enviada_rocket_chat  BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE registro_no_reconocido (
  id                 BIGSERIAL PRIMARY KEY,
  clave              VARCHAR(300) NOT NULL UNIQUE,      -- fuente:codigo_original[#n], estable entre Sincronizaciones (CU-11).
  sincronizacion_id  BIGINT REFERENCES sincronizacion(id),
  fuente_id          SMALLINT NOT NULL REFERENCES fuente(id),
  codigo_original    VARCHAR(255) NOT NULL,
  motivo             TEXT,
  revisado           BOOLEAN NOT NULL DEFAULT FALSE,
  peticion_asignada  VARCHAR(40) REFERENCES peticion(codigo),  -- Petición a la que TI vinculó el registro (CU-11).
  detectado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_peticion_desarrollador ON peticion (desarrollador_id) WHERE estado = 'abierta';
CREATE INDEX idx_peticion_tipo ON peticion (tipo);
CREATE INDEX idx_indicador_desarrollador ON indicador_carga (desarrollador_id, calculado_en DESC);
CREATE INDEX idx_no_reconocido_pendiente ON registro_no_reconocido (detectado_en) WHERE NOT revisado;

-- ---------- Datos iniciales ----------
INSERT INTO rol (clave, nombre, permisos, solo_propios) VALUES
  ('PMO', 'PMO', '{ver:todos,exportar}', FALSE),
  ('TECNICO', 'Técnico', '{ver:propios}', TRUE),
  ('ADMINISTRATIVO', 'Administrativo', '{ver:todos}', FALSE),
  ('ADMINISTRADOR_TI', 'Administrador TI', '{ver:todos,configurar}', FALSE);

INSERT INTO fuente (nombre) VALUES ('redmine'), ('gitlab'), ('glpi'), ('rocketchat');

INSERT INTO umbral (max_peticiones) VALUES (6);
