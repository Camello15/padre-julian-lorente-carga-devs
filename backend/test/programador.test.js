import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cerrarAplicacion, crearSeguimientoSincronizacion, iniciarProgramador } from '../src/sincronizacion/programador.js';

const aplazado = () => {
  let resolver;
  const promesa = new Promise((resolve) => { resolver = resolve; });
  return { promesa, resolver };
};

describe('ciclo de vida del programador', () => {
  it('espera una ejecución inicial activa antes de permitir el cierre', async () => {
    const puerta = aplazado();
    const sincronizacion = {
      enEjecucion: false,
      async ejecutar() {
        this.enEjecucion = true;
        try { await puerta.promesa; } finally { this.enEjecucion = false; }
      },
    };
    const seguimiento = crearSeguimientoSincronizacion(sincronizacion);
    const ejecucion = seguimiento.ejecutar();
    let finalizada = false;
    const espera = seguimiento.esperar().then(() => { finalizada = true; });
    await Promise.resolve();
    assert.equal(finalizada, false);
    puerta.resolver();
    await Promise.all([ejecucion, espera]);
    assert.equal(finalizada, true);
    assert.equal(sincronizacion.enEjecucion, false);
  });

  it('detiene nuevos disparos y espera la ejecución cron activa', async () => {
    const puerta = aplazado();
    let llamadas = 0;
    const sincronizacion = {
      enEjecucion: false,
      async ejecutar() {
        llamadas += 1;
        this.enEjecucion = true;
        try { await puerta.promesa; } finally { this.enEjecucion = false; }
      },
    };
    const seguimiento = crearSeguimientoSincronizacion(sincronizacion);
    const tarea = iniciarProgramador(sincronizacion, '* * * * * *', () => seguimiento.ejecutar());

    for (let intento = 0; intento < 30 && llamadas === 0; intento += 1) {
      await new Promise((resolver) => setTimeout(resolver, 50));
    }
    assert.equal(llamadas, 1);

    await tarea.stop();
    let finalizada = false;
    const espera = seguimiento.esperar().then(() => { finalizada = true; });
    await Promise.resolve();
    assert.equal(finalizada, false);
    puerta.resolver();
    await espera;
    await new Promise((resolver) => setTimeout(resolver, 1100));
    assert.equal(llamadas, 1);
    assert.equal(sincronizacion.enEjecucion, false);
  });

  it('cierra cron y HTTP, espera la sincronización activa y después cierra PostgreSQL', async () => {
    const puerta = aplazado();
    const orden = [];
    const sincronizacion = {
      enEjecucion: false,
      async ejecutar() {
        this.enEjecucion = true;
        try { await puerta.promesa; } finally { this.enEjecucion = false; }
      },
    };
    const seguimiento = crearSeguimientoSincronizacion(sincronizacion);
    const ejecucion = seguimiento.ejecutar();
    const cierre = cerrarAplicacion({
      tareaProgramada: { async stop() { orden.push('cron'); } },
      servidor: {
        listening: true,
        close(callback) { orden.push('http'); callback(); },
      },
      seguimiento,
      persistencia: { async cerrar() { orden.push('postgres'); } },
    });

    await Promise.resolve();
    assert.deepEqual(orden, ['cron', 'http']);
    puerta.resolver();
    await Promise.all([ejecucion, cierre]);
    assert.deepEqual(orden, ['cron', 'http', 'postgres']);
  });
});
