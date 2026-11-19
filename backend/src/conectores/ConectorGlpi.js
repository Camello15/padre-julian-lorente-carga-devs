import { config } from '../config.js';
import { Conector } from './Conector.js';

/** Lee los incidentes asignados desde la mesa de ayuda GLPI (RF-04). */
export class ConectorGlpi extends Conector {
  async leerDatos(desde) {
    if (config.usarMocks) {
      const { tickets } = await this.leerMock('glpi.json');
      return tickets;
    }
    // TODO (Bryan, CU-05): API real de GLPI.
    //   1. GET {GLPI_URL}/apirest.php/initSession  (App-Token + Authorization: user_token ...)
    //   2. GET {GLPI_URL}/apirest.php/Ticket?expand_dropdowns=true&range=0-100 (filtrar date_mod >= desde)
    //   3. GET {GLPI_URL}/apirest.php/killSession
    throw new Error(`Conector GLPI real pendiente (desde ${desde?.toISOString?.() ?? 'inicio'})`);
  }
}
