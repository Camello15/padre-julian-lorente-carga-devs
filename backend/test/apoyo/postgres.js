import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import pg from 'pg';

/** URL del PostgreSQL de pruebas. Sin ella, las pruebas de integración se omiten. */
export const urlPruebas = process.env.TEST_DATABASE_URL ?? '';

const esquemaSql = readFileSync(new URL('../../../database/schema.sql', import.meta.url), 'utf8');

/**
 * Crea un schema temporal con database/schema.sql para aislar cada archivo de pruebas.
 * `crearPool()` devuelve pools nuevos apuntando a ese schema (simula reiniciar el backend).
 */
export async function crearBaseTemporal() {
  const nombre = `prueba_${randomBytes(6).toString('hex')}`;
  const admin = new pg.Client({ connectionString: urlPruebas });
  await admin.connect();
  await admin.query(`CREATE SCHEMA ${nombre}`);
  await admin.query(`SET search_path TO ${nombre}`);
  await admin.query(esquemaSql);

  const pools = [];
  return {
    nombre,
    crearPool() {
      const pool = new pg.Pool({ connectionString: urlPruebas, options: `-c search_path=${nombre}` });
      pools.push(pool);
      return pool;
    },
    consultar: (sql, valores) => admin.query(sql, valores),
    async borrar() {
      await Promise.all(pools.map((p) => p.end().catch(() => {})));
      await admin.query(`DROP SCHEMA ${nombre} CASCADE`);
      await admin.end();
    },
  };
}
