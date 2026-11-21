import cron from 'node-cron';

/** Programador de tareas (actor de CU-05): dispara la Sincronización según SYNC_CRON (cada 15 min). */
export function iniciarProgramador(sincronizacion, expresion) {
  if (!cron.validate(expresion)) {
    throw new Error(`SYNC_CRON no es una expresión cron válida: ${expresion}`);
  }
  return cron.schedule(expresion, async () => {
    try {
      const estado = await sincronizacion.ejecutar();
      if (estado) console.info(`[sincronización] ${estado.fin} estado=${estado.estado}`);
    } catch (error) {
      console.error('[sincronización] error inesperado', error);
    }
  });
}
