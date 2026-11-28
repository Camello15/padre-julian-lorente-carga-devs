import cron from 'node-cron';

export function crearSeguimientoSincronizacion(sincronizacion) {
  let ejecucionActiva = null;

  return {
    ejecutar() {
      if (sincronizacion.enEjecucion) return sincronizacion.ejecutar();
      let ejecucion;
      ejecucion = Promise.resolve(sincronizacion.ejecutar()).finally(() => {
        if (ejecucionActiva === ejecucion) ejecucionActiva = null;
      });
      ejecucionActiva = ejecucion;
      return ejecucion;
    },
    async esperar() {
      while (ejecucionActiva) {
        const ejecucion = ejecucionActiva;
        try {
          await ejecucion;
        } catch {
          // El cierre espera la operación; el error ya se informa en el punto de ejecución.
        }
        if (ejecucionActiva === ejecucion) break;
      }
    },
  };
}

/** Programador de tareas (actor de CU-05): dispara la Sincronización según SYNC_CRON (cada 15 min). */
export function iniciarProgramador(sincronizacion, expresion, ejecutar = () => sincronizacion.ejecutar()) {
  if (!cron.validate(expresion)) {
    throw new Error(`SYNC_CRON no es una expresión cron válida: ${expresion}`);
  }
  return cron.schedule(expresion, async () => {
    try {
      const estado = await ejecutar();
      if (estado) console.info(`[sincronización] ${estado.fin} estado=${estado.estado}`);
    } catch (error) {
      console.error('[sincronización] error inesperado', error);
    }
  });
}

export async function cerrarAplicacion({ tareaProgramada, servidor, seguimiento, persistencia }) {
  let errorCierre;
  try {
    if (tareaProgramada) await tareaProgramada.stop();
  } catch (error) {
    errorCierre = error;
  }

  if (servidor?.listening) {
    try {
      await new Promise((resolve, reject) => servidor.close((error) => (error ? reject(error) : resolve())));
    } catch (error) {
      errorCierre ??= error;
    }
  }

  await seguimiento?.esperar();
  try {
    await persistencia?.cerrar();
  } catch (error) {
    errorCierre ??= error;
  }
  if (errorCierre) throw errorCierre;
}
