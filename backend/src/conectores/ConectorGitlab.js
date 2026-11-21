import { config } from '../config.js';
import { Conector } from './Conector.js';

/** Lee commits, merge requests y pipelines por Desarrollador desde GitLab (RF-03). */
export class ConectorGitlab extends Conector {
  async leerDatos(desde) {
    if (config.usarMocks) {
      const { eventos } = await this.leerMock('gitlab.json');
      return eventos;
    }
    // TODO (Bryan, CU-05): API real de GitLab (v4).
    //   GET {GITLAB_URL}/api/v4/projects/:id/repository/commits?since=<desde>&all=true
    //   GET {GITLAB_URL}/api/v4/projects/:id/merge_requests?updated_after=<desde>
    //   GET {GITLAB_URL}/api/v4/projects/:id/pipelines?updated_after=<desde>
    //   Cabecera: PRIVATE-TOKEN: config.fuentes.gitlab.token
    //   El código de la Petición se toma del nombre de la rama (Gitflow: feature/REC-2026-014-...).
    throw new Error(`Conector GitLab real pendiente (desde ${desde?.toISOString?.() ?? 'inicio'})`);
  }
}
