import { config } from '../config.js';
import { Conector } from './Conector.js';

/** Lee notificaciones relevantes de los canales de Rocket Chat (RF-05). */
export class ConectorRocketChat extends Conector {
  async leerDatos(desde) {
    if (config.usarMocks) {
      const { mensajes } = await this.leerMock('rocketchat.json');
      return mensajes;
    }
    // TODO (Bryan, CU-05): API real de Rocket Chat.
    //   GET {ROCKETCHAT_URL}/api/v1/channels.messages?roomName=<canal>&query={"ts":{"$gte":{"$date":"<desde>"}}}
    //   Cabeceras: X-Auth-Token y X-User-Id. Confirmar con la cooperativa qué canales son relevantes.
    throw new Error(`Conector Rocket Chat real pendiente (desde ${desde?.toISOString?.() ?? 'inicio'})`);
  }
}
