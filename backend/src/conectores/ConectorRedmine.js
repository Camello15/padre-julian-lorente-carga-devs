import { config } from '../config.js';
import { Conector } from './Conector.js';

/** Lee peticiones (POA, REC, Iniciativa, Incidente) y su Etapa desde RedMine (RF-02). */
export class ConectorRedmine extends Conector {
  async leerDatos(desde) {
    if (config.usarMocks) {
      const { issues } = await this.leerMock('redmine.json');
      return issues;
    }
    // TODO (Bryan, CU-05): API real de RedMine.
    //   GET {REDMINE_URL}/issues.json?status_id=*&updated_on=>=<desde>&limit=100&offset=N
    //   Cabecera: X-Redmine-API-Key: config.fuentes.redmine.apiKey
    //   Paginar con total_count/offset. Confirmar con la cooperativa los nombres de los
    //   campos personalizados "Código", "Etapa" y "Módulo del core".
    throw new Error(`Conector RedMine real pendiente (desde ${desde?.toISOString?.() ?? 'inicio'})`);
  }
}
