-- Aplicar una sola vez a bases existentes que ya tengan la tabla fuente.
BEGIN;
CREATE TABLE IF NOT EXISTS snapshot_fuente (
  fuente_id  SMALLINT PRIMARY KEY REFERENCES fuente(id),
  datos      JSONB NOT NULL CHECK (jsonb_typeof(datos) = 'array'),
  fecha      TIMESTAMPTZ NOT NULL,
  cursor     TIMESTAMPTZ,
  metadatos  JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(metadatos) = 'array')
);
COMMIT;
