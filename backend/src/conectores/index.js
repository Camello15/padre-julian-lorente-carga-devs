import { config } from '../config.js';
import { ConectorGitlab } from './ConectorGitlab.js';
import { ConectorGlpi } from './ConectorGlpi.js';
import { ConectorRedmine } from './ConectorRedmine.js';
import { ConectorRocketChat } from './ConectorRocketChat.js';

/** Registro de Fuentes. Para sumar una Fuente nueva se agrega una línea aquí (RNF-04). */
export function crearConectores(fuentes = config.fuentes) {
  return [
    new ConectorRedmine({ nombre: 'redmine', urlApi: fuentes.redmine.url, activa: true }),
    new ConectorGitlab({ nombre: 'gitlab', urlApi: fuentes.gitlab.url, activa: true }),
    new ConectorGlpi({ nombre: 'glpi', urlApi: fuentes.glpi.url, activa: true }),
    new ConectorRocketChat({ nombre: 'rocketchat', urlApi: fuentes.rocketchat.url, activa: true }),
  ].filter((conector) => conector.fuente.activa);
}
