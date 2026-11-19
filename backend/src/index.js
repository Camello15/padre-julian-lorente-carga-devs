import { readFileSync } from 'node:fs';
import { crearApp } from './app.js';
import { ServicioSesiones } from './auth/sso-mock.js';
import { config } from './config.js';
import { crearConectores } from './conectores/index.js';
import { AlmacenMemoria } from './datos/almacen.js';
import { iniciarProgramador } from './sincronizacion/programador.js';
import { Sincronizacion } from './sincronizacion/Sincronizacion.js';

// Catálogo de Desarrolladores con su usuario en cada Fuente (mapeo de identidades).
// TODO (Cristina): mover a la tabla desarrollador de PostgreSQL.
const desarrolladores = JSON.parse(readFileSync(new URL('../mocks/desarrolladores.json', import.meta.url), 'utf8'));

const almacen = new AlmacenMemoria();
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

const estado = await sincronizacion.ejecutar();
console.info(`[sincronización] inicial estado=${estado.estado} peticiones=${almacen.peticiones.length}`);
iniciarProgramador(sincronizacion, config.sincronizacion.cron);

app.listen(config.puerto, () => {
  console.info(`API escuchando en http://localhost:${config.puerto} (mocks=${config.usarMocks}, SSO=${config.sso.modo})`);
});
