-- Aplicar una sola vez a bases creadas con el esquema anterior (después de 001-snapshot-fuente.sql).
-- Alinea las columnas con el código y agrega lo que necesita AlmacenPostgres (Datos y alertas).
BEGIN;

-- Rol: clave del código (PMO, TECNICO, ADMINISTRATIVO, ADMINISTRADOR_TI).
ALTER TABLE rol ADD COLUMN IF NOT EXISTS clave VARCHAR(20);
UPDATE rol SET clave = CASE nombre
  WHEN 'PMO' THEN 'PMO'
  WHEN 'Técnico' THEN 'TECNICO'
  WHEN 'Administrativo' THEN 'ADMINISTRATIVO'
  WHEN 'Administrador TI' THEN 'ADMINISTRADOR_TI'
END
WHERE clave IS NULL;
ALTER TABLE rol ALTER COLUMN clave SET NOT NULL;
ALTER TABLE rol ADD CONSTRAINT rol_clave_key UNIQUE (clave);

-- Petición: estado ('abierta' | 'cerrada') en lugar de abierta BOOLEAN.
ALTER TABLE peticion ADD COLUMN estado VARCHAR(10) NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta', 'cerrada'));
UPDATE peticion SET estado = CASE WHEN abierta THEN 'abierta' ELSE 'cerrada' END;
DROP INDEX IF EXISTS idx_peticion_desarrollador;
ALTER TABLE peticion DROP COLUMN abierta;
CREATE INDEX idx_peticion_desarrollador ON peticion (desarrollador_id) WHERE estado = 'abierta';

-- Alerta: nombre del código (enviadaRocketChat) y datos para no reenviar tras reiniciar.
ALTER TABLE alerta RENAME COLUMN enviada_rocketchat TO enviada_rocket_chat;
ALTER TABLE alerta ADD COLUMN peticiones_abiertas INTEGER NOT NULL DEFAULT 0;
ALTER TABLE alerta ADD COLUMN umbral INTEGER NOT NULL DEFAULT 0;
ALTER TABLE alerta ALTER COLUMN peticiones_abiertas DROP DEFAULT;
ALTER TABLE alerta ALTER COLUMN umbral DROP DEFAULT;

-- Registro no reconocido: clave estable entre sincronizaciones y petición asignada (CU-11).
ALTER TABLE registro_no_reconocido ADD COLUMN clave VARCHAR(300);
UPDATE registro_no_reconocido r
SET clave = f.nombre || ':' || r.codigo_original || '#' || r.id
FROM fuente f WHERE f.id = r.fuente_id AND r.clave IS NULL;
ALTER TABLE registro_no_reconocido ALTER COLUMN clave SET NOT NULL;
ALTER TABLE registro_no_reconocido ADD CONSTRAINT registro_no_reconocido_clave_key UNIQUE (clave);
ALTER TABLE registro_no_reconocido ADD COLUMN peticion_asignada VARCHAR(40) REFERENCES peticion(codigo);

COMMIT;
