import pg from 'pg';
import { restaurarHistorialAlertas } from './alertas.js';
import { AlmacenMemoria } from './almacen.js';

const iso = (fecha) => (fecha instanceof Date ? fecha.toISOString() : fecha ?? null);

/**
 * Almacén con persistencia en PostgreSQL (database/schema.sql) para el módulo Datos y alertas.
 *
 * La memoria (AlmacenMemoria) sigue siendo la caché de lectura, así que las rutas no cambian.
 * Cada escritura se guarda además en PostgreSQL dentro de una transacción, y al arrancar
 * `inicializar()` recupera lo que debe sobrevivir a un reinicio: el Umbral configurado (CU-10),
 * las revisiones de registros no reconocidos (CU-11), el estado de la última Sincronización
 * y las Alertas ya enviadas a Rocket Chat (CU-09).
 *
 * División con Integración: las filas de `sincronizacion`, `registro_fallo` y `snapshot_fuente`
 * las escribe RepositorioSincronizacionPostgres. Este almacén solo las lee y enlaza sus datos
 * al `sincronizacionId` que recibe en `guardarResultado()`.
 */
export class AlmacenPostgres extends AlmacenMemoria {
  /** @param {{ pool?: pg.Pool, connectionString?: string }} opciones  Si recibe `pool`, no lo cierra: es compartido. */
  constructor({ pool, connectionString } = {}) {
    super();
    this.poolPropio = !pool;
    this.pool = pool ?? new pg.Pool({ connectionString });
    this.idsFuente = new Map();
  }

  async transaccion(trabajo) {
    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');
      const resultado = await trabajo(cliente);
      await cliente.query('COMMIT');
      return resultado;
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
  }

  async idFuente(cliente, nombre) {
    if (!this.idsFuente.has(nombre)) {
      const { rows } = await cliente.query(
        `INSERT INTO fuente (nombre) VALUES ($1)
         ON CONFLICT (nombre) DO UPDATE SET nombre = EXCLUDED.nombre RETURNING id`,
        [nombre],
      );
      this.idsFuente.set(nombre, rows[0].id);
    }
    return this.idsFuente.get(nombre);
  }

  /**
   * Prepara la base (catálogos de Desarrolladores y Usuarios) y carga el estado guardado.
   * `umbral` es el objeto compartido con las rutas y la Sincronización: se actualiza en sitio.
   */
  async inicializar({ desarrolladores = [], usuarios = [], umbral } = {}) {
    await this.transaccion(async (c) => {
      for (const d of desarrolladores) {
        await c.query(
          `INSERT INTO desarrollador (id, nombre, correo, usuario_gitlab, id_redmine, usuario_glpi)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, correo = EXCLUDED.correo,
             usuario_gitlab = EXCLUDED.usuario_gitlab, id_redmine = EXCLUDED.id_redmine, usuario_glpi = EXCLUDED.usuario_glpi`,
          [d.id, d.nombre, d.correo ?? null, d.usuarioGitlab ?? null, d.idRedmine ?? null, d.usuarioGlpi ?? null],
        );
      }
      // TODO (Camilo): con el SSO real, el Usuario se registra al iniciar sesión en vez de venir de los mocks.
      for (const u of usuarios) {
        await c.query(
          `INSERT INTO usuario (id, nombre, correo, id_sso, rol_id, desarrollador_id)
           VALUES ($1, $2, $3, $4, (SELECT id FROM rol WHERE clave = $5), $6)
           ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, correo = EXCLUDED.correo,
             id_sso = EXCLUDED.id_sso, rol_id = EXCLUDED.rol_id, desarrollador_id = EXCLUDED.desarrollador_id`,
          [u.id, u.nombre, u.correo, u.idSso, u.rol, u.desarrolladorId ?? null],
        );
      }
    });

    const fuentes = await this.pool.query('SELECT id, nombre FROM fuente');
    this.idsFuente = new Map(fuentes.rows.map((f) => [f.nombre, f.id]));
    this.desarrolladores = desarrolladores;

    if (umbral) await this.cargarUmbral(umbral);
    await this.cargarRegistrosNoReconocidos();
    await this.cargarEstadoSincronizacion();
    await this.cargarHistorialAlertas();
  }

  /** Solo un Umbral configurado por un Usuario (CU-10) reemplaza al de UMBRAL_MAX_PETICIONES. */
  async cargarUmbral(umbral) {
    const { rows } = await this.pool.query(
      `SELECT max_peticiones, vigente_desde, configurado_por FROM umbral
       WHERE configurado_por IS NOT NULL ORDER BY vigente_desde DESC, id DESC LIMIT 1`,
    );
    if (rows.length > 0) {
      const [u] = rows;
      Object.assign(umbral, { maxPeticiones: u.max_peticiones, vigenteDesde: iso(u.vigente_desde), configuradoPor: u.configurado_por });
    }
  }

  async cargarRegistrosNoReconocidos() {
    const { rows } = await this.pool.query(
      `SELECT r.clave, f.nombre AS fuente, r.codigo_original, r.motivo, r.revisado, r.peticion_asignada, r.detectado_en
       FROM registro_no_reconocido r JOIN fuente f ON f.id = r.fuente_id ORDER BY r.id`,
    );
    this.registrosNoReconocidos = rows.map((r) => ({
      id: r.clave,
      codigoOriginal: r.codigo_original,
      fuente: r.fuente,
      motivo: r.motivo,
      revisado: r.revisado,
      peticionAsignada: r.peticion_asignada,
      detectadoEn: iso(r.detectado_en),
    }));
  }

  async cargarEstadoSincronizacion() {
    const ultima = await this.pool.query(
      "SELECT inicio, fin, estado FROM sincronizacion WHERE estado <> 'en-curso' ORDER BY id DESC LIMIT 1",
    );
    if (ultima.rows.length === 0) return;
    const exitosa = await this.pool.query("SELECT max(inicio) AS inicio FROM sincronizacion WHERE estado = 'ok'");
    const fallos = await this.pool.query(
      `SELECT f.nombre AS fuente, r.fecha, r.intentos, r.mensaje
       FROM registro_fallo r JOIN fuente f ON f.id = r.fuente_id ORDER BY r.fecha DESC, r.id DESC LIMIT 50`,
    );
    const [s] = ultima.rows;
    this.estadoSincronizacion = {
      estado: s.estado,
      inicio: iso(s.inicio),
      fin: iso(s.fin),
      ultimaExitosa: iso(exitosa.rows[0].inicio),
      fuentes: [],
      fallos: fallos.rows.map((f) => ({ fuente: f.fuente, fecha: iso(f.fecha), intentos: f.intentos, mensaje: f.mensaje })),
    };
  }

  async cargarHistorialAlertas() {
    const { rows } = await this.pool.query(
      `SELECT DISTINCT ON (i.desarrollador_id) i.desarrollador_id, a.peticiones_abiertas, a.umbral
       FROM alerta a JOIN indicador_carga i ON i.id = a.indicador_carga_id
       WHERE a.enviada_rocket_chat ORDER BY i.desarrollador_id, a.fecha DESC, a.id DESC`,
    );
    restaurarHistorialAlertas(
      rows.map((r) => ({ desarrolladorId: r.desarrollador_id, peticionesAbiertas: r.peticiones_abiertas, umbral: r.umbral })),
    );
  }

  /**
   * Guarda en una sola transacción lo que traiga el resultado (Sincronización completa o recálculo por Umbral).
   * `sincronizacionId` es la fila creada por RepositorioSincronizacionPostgres (null en un recálculo por Umbral).
   */
  async guardarResultado({ sincronizacionId = null, ...resultado }) {
    super.guardarResultado(resultado);
    await this.transaccion(async (c) => {
      if (resultado.peticiones) await this.guardarPeticiones(c, resultado.proyectos ?? [], resultado.peticiones);
      const idsIndicador = resultado.indicadores
        ? await this.guardarIndicadores(c, resultado.indicadores, sincronizacionId)
        : new Map();
      if (resultado.alertas) await this.guardarAlertas(c, resultado.alertas, idsIndicador);
      if (resultado.registrosNoReconocidos) await this.guardarRegistrosNoReconocidos(c, sincronizacionId);
    });
  }

  async guardarPeticiones(c, proyectos, peticiones) {
    for (const p of proyectos) {
      await c.query(
        'INSERT INTO proyecto (codigo, nombre) VALUES ($1, $2) ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre',
        [p.codigo, p.nombre],
      );
    }
    const idsModulo = new Map();
    for (const nombre of new Set(peticiones.flatMap((p) => p.modulosCore ?? []))) {
      const { rows } = await c.query(
        `INSERT INTO modulo_core (nombre) VALUES ($1)
         ON CONFLICT (nombre) DO UPDATE SET nombre = EXCLUDED.nombre RETURNING id`,
        [nombre],
      );
      idsModulo.set(nombre, rows[0].id);
    }

    for (const p of peticiones) {
      await c.query(
        `INSERT INTO peticion (codigo, titulo, tipo, etapa, estado, desarrollador_id, proyecto_codigo,
           fecha_inicio, fecha_fin, id_redmine, id_glpi, actualizado_en)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
         ON CONFLICT (codigo) DO UPDATE SET titulo = EXCLUDED.titulo, tipo = EXCLUDED.tipo, etapa = EXCLUDED.etapa,
           estado = EXCLUDED.estado, desarrollador_id = EXCLUDED.desarrollador_id, proyecto_codigo = EXCLUDED.proyecto_codigo,
           fecha_inicio = EXCLUDED.fecha_inicio, fecha_fin = EXCLUDED.fecha_fin, id_redmine = EXCLUDED.id_redmine,
           id_glpi = EXCLUDED.id_glpi, actualizado_en = now()`,
        [
          p.codigo, p.titulo, p.tipo, p.etapa, p.estado, p.desarrolladorId ?? null, p.proyectoId ?? null,
          p.fechaInicio ?? null, p.fechaFin ?? null, p.idsOrigen?.redmine ?? null, p.idsOrigen?.glpi ?? null,
        ],
      );
      await c.query('DELETE FROM peticion_modulo WHERE peticion_codigo = $1', [p.codigo]);
      for (const nombre of new Set(p.modulosCore ?? [])) {
        await c.query('INSERT INTO peticion_modulo (peticion_codigo, modulo_id) VALUES ($1, $2)', [p.codigo, idsModulo.get(nombre)]);
      }
      for (const a of p.actividades ?? []) {
        await c.query(
          `INSERT INTO actividad_codigo (peticion_codigo, desarrollador_id, tipo, rama, id_origen, estado, fecha)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (tipo, id_origen) DO UPDATE SET peticion_codigo = EXCLUDED.peticion_codigo,
             desarrollador_id = EXCLUDED.desarrollador_id, rama = EXCLUDED.rama, estado = EXCLUDED.estado, fecha = EXCLUDED.fecha`,
          [p.codigo, a.desarrolladorId ?? null, a.tipo, a.rama, a.idOrigen, a.estado ?? null, a.fecha],
        );
      }
    }
  }

  async guardarIndicadores(c, indicadores, sincronizacionId) {
    const ids = new Map();
    for (const i of indicadores) {
      const { rows } = await c.query(
        `INSERT INTO indicador_carga (desarrollador_id, sincronizacion_id, peticiones_abiertas, avance_promedio, calculado_en)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [i.desarrolladorId, sincronizacionId, i.peticionesAbiertas, Math.round(i.avancePromedio ?? 0), i.calculadoEn],
      );
      ids.set(i.desarrolladorId, rows[0].id);
    }
    return ids;
  }

  async guardarAlertas(c, alertas, idsIndicador) {
    for (const a of alertas) {
      const indicadorId = idsIndicador.get(a.desarrolladorId);
      if (!indicadorId) continue; // Una Alerta siempre nace de un IndicadorCarga de este mismo resultado.
      await c.query(
        `INSERT INTO alerta (indicador_carga_id, mensaje, peticiones_abiertas, umbral, fecha, enviada_rocket_chat)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [indicadorId, a.mensaje, a.peticionesAbiertas, a.umbral, a.fecha, Boolean(a.enviadaRocketChat)],
      );
    }
  }

  /** La revisión (revisado, peticion_asignada) no se pisa: solo la cambia el Administrador TI (CU-11). */
  async guardarRegistrosNoReconocidos(c, sincronizacionId) {
    for (const r of this.registrosNoReconocidos) {
      await c.query(
        `INSERT INTO registro_no_reconocido
           (clave, sincronizacion_id, fuente_id, codigo_original, motivo, revisado, peticion_asignada, detectado_en)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (clave) DO UPDATE SET sincronizacion_id = COALESCE(EXCLUDED.sincronizacion_id, registro_no_reconocido.sincronizacion_id),
           motivo = EXCLUDED.motivo`,
        [r.id, sincronizacionId, await this.idFuente(c, r.fuente), r.codigoOriginal, r.motivo ?? null,
          Boolean(r.revisado), r.peticionAsignada ?? null, r.detectadoEn ?? new Date().toISOString()],
      );
    }
  }

  async guardarUmbral(umbral) {
    await this.pool.query(
      'INSERT INTO umbral (max_peticiones, vigente_desde, configurado_por) VALUES ($1, $2, $3)',
      [umbral.maxPeticiones, umbral.vigenteDesde ?? new Date().toISOString(), umbral.configuradoPor ?? null],
    );
  }

  async marcarRegistroNoReconocido(id, peticionCodigo = null) {
    const existe = this.registrosNoReconocidos.some((r) => String(r.id) === String(id));
    if (!existe) return null;
    await this.pool.query(
      `UPDATE registro_no_reconocido SET revisado = TRUE, peticion_asignada = COALESCE($2, peticion_asignada)
       WHERE clave = $1`,
      [String(id), peticionCodigo],
    );
    return super.marcarRegistroNoReconocido(id, peticionCodigo);
  }

  async cerrar() {
    if (this.poolPropio) await this.pool.end();
  }
}
