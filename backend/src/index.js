import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { crearApp } from './app.js';
import { ServicioSesiones } from './auth/sso-mock.js';
import { config } from './config.js';
import { crearConectores } from './conectores/index.js';
import { AlmacenMemoria } from './datos/almacen.js';
import { RepositorioSincronizacionPostgres } from './datos/RepositorioSincronizacionPostgres.js';
import { cerrarAplicacion, crearSeguimientoSincronizacion, iniciarProgramador } from './sincronizacion/programador.js';
import { Sincronizacion } from './sincronizacion/Sincronizacion.js';

// Catálogo de Desarrolladores con su usuario en cada Fuente (mapeo de identidades).
// TODO (Cristina): mover a la tabla desarrollador de PostgreSQL.
const desarrolladores = JSON.parse(readFileSync(new URL('../mocks/desarrolladores.json', import.meta.url), 'utf8'));

const almacen = new AlmacenMemoria();
const conectores = crearConectores();
const pool = config.databaseUrl ? new Pool({ connectionString: config.databaseUrl }) : null;
const persistencia = pool ? new RepositorioSincronizacionPostgres(pool) : null;

if (persistencia) {
  try {
    await persistencia.recuperarSincronizacionesAbandonadas();
    const snapshots = await persistencia.cargarSnapshots();
    for (const snapshot of snapshots) {
      almacen.rehidratarSnapshotFuente(snapshot.nombre, snapshot.datos, snapshot.fecha, snapshot.cursor);
      if (snapshot.nombre === 'rocketchat') {
        const conector = conectores.find((item) => item.fuente.nombre === snapshot.nombre);
        conector?.rehidratarMetadatos(snapshot.datos, snapshot.metadatos);
      }
    }
  } catch {
    await persistencia.cerrar().catch(() => {});
    throw new Error('PostgreSQL no está disponible o sus snapshots iniciales son inválidos; no se iniciará sin persistencia.');
  }
}

const sincronizacion = new Sincronizacion({
  conectores,
  almacen,
  desarrolladores,
  umbral: config.umbral,
  reintentos: config.sincronizacion.reintentos,
  esperaReintentoMs: config.sincronizacion.esperaReintentoMs,
  persistencia,
  modoMocks: config.usarMocks,
});
const seguimiento = crearSeguimientoSincronizacion(sincronizacion);

const app = crearApp({
  almacen,
  servicioSesiones: new ServicioSesiones(),
  umbral: config.umbral,
  origenFrontend: config.origenFrontend,
});

let tareaProgramada;
let servidor;
let cerrando = false;
let cierre;

const apagar = () => {
  if (cierre) return cierre;
  cerrando = true;
  cierre = cerrarAplicacion({ tareaProgramada, servidor, seguimiento, persistencia });
  return cierre;
};

const solicitarApagado = () => {
  apagar().catch(() => { process.exitCode = 1; });
};
process.once('SIGINT', solicitarApagado);
process.once('SIGTERM', solicitarApagado);

try {
  const estado = await seguimiento.ejecutar();
  if (cerrando) {
    await cierre;
  } else {
    console.info(`[sincronización] inicial estado=${estado.estado} peticiones=${almacen.peticiones.length}`);
    tareaProgramada = iniciarProgramador(sincronizacion, config.sincronizacion.cron, () => seguimiento.ejecutar());
    servidor = app.listen(config.puerto, () => {
      console.info(`API escuchando en http://localhost:${config.puerto} (mocks=${config.usarMocks}, SSO=${config.sso.modo})`);
    });
  }
} catch (error) {
  await seguimiento.esperar();
  await persistencia?.cerrar().catch(() => {});
  throw error;
}
