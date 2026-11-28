const FUENTES_CONSULTA = `
  SELECT id, nombre
  FROM fuente
  WHERE nombre = ANY($1::varchar[])
`;

const validarFilas = (filas, fuentes) => {
  const ids = new Map(filas.map(({ id, nombre }) => [nombre, id]));
  const faltantes = fuentes.filter((nombre) => !ids.has(nombre));
  if (faltantes.length) {
    throw new Error(`Fuentes no registradas en PostgreSQL: ${faltantes.join(', ')}`);
  }
  return ids;
};

export class RepositorioSincronizacionPostgres {
  constructor(pool) {
    this.pool = pool;
    this.promesaCierre = null;
  }

  async cargarSnapshots() {
    const { rows } = await this.pool.query(`
      SELECT f.nombre, s.datos, s.fecha, s.cursor, s.metadatos
      FROM snapshot_fuente s
      JOIN fuente f ON f.id = s.fuente_id
    `);
    return rows.map((fila) => {
      if (!Array.isArray(fila.datos) || !Array.isArray(fila.metadatos)) {
        throw new Error(`Snapshot inválido en PostgreSQL para la fuente ${fila.nombre}`);
      }
      return {
        nombre: fila.nombre,
        datos: fila.datos,
        fecha: new Date(fila.fecha).toISOString(),
        cursor: fila.cursor === null ? null : new Date(fila.cursor).toISOString(),
        metadatos: fila.metadatos,
      };
    });
  }

  async recuperarSincronizacionesAbandonadas() {
    const { rowCount } = await this.pool.query(
      `UPDATE sincronizacion
       SET estado = 'fallida', fin = NOW()
       WHERE estado = 'en-curso' AND fin IS NULL`,
    );
    return rowCount;
  }

  async crearSincronizacion(inicio) {
    const { rows } = await this.pool.query(
      "INSERT INTO sincronizacion (inicio, estado) VALUES ($1, 'en-curso') RETURNING id",
      [inicio],
    );
    if (!rows[0]?.id) throw new Error('PostgreSQL no devolvió el id de sincronización');
    return rows[0].id;
  }

  async finalizarSincronizacion({ id, fin, estado, fallos, snapshots }) {
    const nombres = [...new Set([
      ...fallos.map((fallo) => fallo.fuente),
      ...snapshots.map((snapshot) => snapshot.nombre),
    ])];
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const resultadoFuentes = nombres.length
        ? await client.query(FUENTES_CONSULTA, [nombres])
        : { rows: [] };
      const idsFuentes = validarFilas(resultadoFuentes.rows, nombres);

      for (const fallo of fallos) {
        await client.query(
          `INSERT INTO registro_fallo (sincronizacion_id, fuente_id, fecha, intentos, mensaje)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, idsFuentes.get(fallo.fuente), fallo.fecha, fallo.intentos, fallo.mensaje],
        );
      }

      const actualizacion = await client.query(
        'UPDATE sincronizacion SET fin = $2, estado = $3 WHERE id = $1',
        [id, fin, estado],
      );
      if (actualizacion.rowCount !== 1) {
        throw new Error('No se encontró la sincronización que debía finalizar');
      }

      for (const snapshot of snapshots) {
        await client.query(
          `INSERT INTO snapshot_fuente (fuente_id, datos, fecha, cursor, metadatos)
           VALUES ($1, $2::jsonb, $3, $4, $5::jsonb)
           ON CONFLICT (fuente_id) DO UPDATE
           SET datos = EXCLUDED.datos,
               fecha = EXCLUDED.fecha,
               cursor = EXCLUDED.cursor,
               metadatos = EXCLUDED.metadatos`,
          [
            idsFuentes.get(snapshot.nombre),
            JSON.stringify(snapshot.datos),
            snapshot.fecha,
            snapshot.cursor,
            JSON.stringify(snapshot.metadatos),
          ],
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Se conserva y propaga el error que originó el rollback.
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async cerrar() {
    if (!this.promesaCierre) this.promesaCierre = this.pool.end();
    await this.promesaCierre;
  }
}
