/**
 * Almacén en memoria con el resultado de la última Sincronización.
 * TODO (Cristina): reemplazar por PostgreSQL (database/schema.sql) con upsert sin duplicados.
 * Las rutas solo usan esta interfaz, así que el cambio no las afecta.
 */
export class AlmacenMemoria {
  constructor() {
    this.ultimosDatosPorFuente = new Map();
    this.desarrolladores = [];
    this.proyectos = [];
    this.peticiones = [];
    this.indicadores = [];
    this.alertas = [];
    this.registrosNoReconocidos = [];
    this.notificaciones = [];
    this.estadoSincronizacion = { estado: 'pendiente', inicio: null, fin: null, fuentes: [], fallos: [] };
  }

  guardarDatosFuente(nombreFuente, datos, fecha) {
    this.ultimosDatosPorFuente.set(nombreFuente, { datos, fecha: fecha.toISOString() });
  }

  ultimosDatosFuente(nombreFuente) {
    return this.ultimosDatosPorFuente.get(nombreFuente) ?? null;
  }

  guardarResultado(resultado) {
    Object.assign(this, resultado);
  }
}
