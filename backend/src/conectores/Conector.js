import { readFile } from 'node:fs/promises';
import { config } from '../config.js';

/**
 * Conector abstracto (RNF-04). Cada Fuente se lee con un Conector;
 * para agregar otra Fuente basta con crear una subclase y registrarla en conectores/index.js.
 */
export class Conector {
  /** @param {{ nombre: string, urlApi: string, activa: boolean }} fuente */
  constructor(fuente) {
    if (new.target === Conector) {
      throw new TypeError('Conector es abstracta: usa una subclase');
    }
    this.fuente = fuente;
  }

  /** Devuelve los registros crudos de la Fuente modificados desde la fecha indicada. */
  async leerDatos(_desde) {
    throw new Error(`${this.constructor.name} debe implementar leerDatos()`);
  }

  /** Lee el JSON de prueba de backend/mocks. MOCK_FALLA_FUENTE simula una caída de la Fuente. */
  async leerMock(archivo) {
    if (config.mockFallaFuente === this.fuente.nombre) {
      throw new Error(`Fallo simulado en ${this.fuente.nombre} (MOCK_FALLA_FUENTE)`);
    }
    const contenido = await readFile(new URL(`../../mocks/${archivo}`, import.meta.url), 'utf8');
    return JSON.parse(contenido);
  }
}
