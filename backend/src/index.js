import { readFileSync } from 'node:fs';
import { crearApp } from './app.js';
import { ServicioSesiones } from './auth/sso-mock.js';
import { config } from './config.js';
import { crearConectores } from './conectores/index.js';
import { AlmacenMemoria } from './datos/almacen.js';
import { AlmacenPostgres } from './datos/almacen-postgres.js';
import { iniciarProgramador } from './sincronizacion/programador.js';
import { Sincronizacion } from './sincronizacion/Sincronizacion.js';

const leerMock = (archivo) => JSON.parse(readFileSync(new URL(`../mocks/${archivo}`, import.meta.url), 'utf8'));

// Catálogo de Desarrolladores con su usuario en cada Fuente (mapeo de identidades).
// Con PostgreSQL se copia a la tabla desarrollador al arrancar.
const desarrolladores = leerMock('desarrolladores.json');

// Con DATABASE_URL los datos se guardan en PostgreSQL; sin ella, solo en memoria.
const almacen = config.baseDatos.url ? new AlmacenPostgres({ connectionString: config.baseDatos.url }) : new AlmacenMemoria();
if (almacen instanceof AlmacenPostgres) {
  await almacen.inicializar({ desarrolladores, usuarios: leerMock('usuarios-sso.json'), umbral: config.umbral });
  console.info(`[almacén] PostgreSQL conectado (umbral vigente: ${config.umbral.maxPeticiones})`);
} else {
  console.info('[almacén] en memoria: define DATABASE_URL para usar PostgreSQL');
}

const sincronizacion = new Sincronizacion({
  conectores: crearConectores(),
  almacen,
  desarrolladores,
  umbral: config.umbral,
  reintentos: config.sincronizacion.reintentos,
  esperaReintentoMs: config.sincronizacion.esperaReintentoMs,
});

const app = crearApp({
  almacen,
  servicioSesiones: new ServicioSesiones(),
  umbral: config.umbral,
  origenFrontend: config.origenFrontend,
});

try {
  const estado = await sincronizacion.ejecutar();
  console.info(`[sincronización] inicial estado=${estado.estado} peticiones=${almacen.peticiones.length}`);
} catch (error) {
  console.error('[sincronización] la sincronización inicial falló', error);
}
const programador = iniciarProgramador(sincronizacion, config.sincronizacion.cron);

const servidor = app.listen(config.puerto, () => {
  console.info(`API escuchando en http://localhost:${config.puerto} (mocks=${config.usarMocks}, SSO=${config.sso.modo})`);
});

// Cierre ordenado (docker compose stop envía SIGTERM).
for (const senal of ['SIGTERM', 'SIGINT']) {
  process.once(senal, () => {
    programador.stop();
    servidor.close(async () => {
      if (typeof almacen.cerrar === 'function') await almacen.cerrar();
      process.exit(0);
    });
  });
}
