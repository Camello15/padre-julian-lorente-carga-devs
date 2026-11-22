# padre-julian-lorente-carga-devs

Proyecto académico UTPL – Reto 2 COAC Padre Julián Lorente: dashboard que centraliza la carga de trabajo de los desarrolladores (RedMine, GitLab, GLPI, Rocket Chat).

El área de TI de la cooperativa reparte su trabajo entre RedMine, GitLab, GLPI y Rocket Chat. Este prototipo lee las cuatro herramientas por API cada 15 minutos, unifica los datos por desarrollador y los muestra en un dashboard con carga, avance, filtros, alertas y exportación.

> **Estado:** prototipo con **datos de prueba** y **SSO simulado**. Todavía no hay acceso a las APIs reales de la cooperativa. Todos los nombres de personas, proyectos y peticiones son ficticios.

## Equipo

| Integrante | Módulo |
|---|---|
| Camilo Velepucha | Usuario web y seguridad (frontend y UX) |
| Bryan Villa | Integración (backend, conectores, cron) |
| Cristina Feijo | Datos y alertas (base de datos, cálculo, alertas) |

## Estructura

```
├── frontend/            React + Vite + Chart.js: login y dashboard
├── backend/             Node.js + Express: API, conectores y sincronización
│   ├── src/conectores/      Conector (abstracta) y un conector por fuente
│   ├── src/sincronizacion/  cron cada 15 min, 3 reintentos por fuente, cruce por código
│   ├── src/datos/           avance por etapa, carga, umbral, filtros, alertas
│   ├── src/auth/            SSO simulado y roles (PMO, Técnico, Administrativo)
│   └── mocks/               datos de prueba de las cuatro fuentes
├── database/schema.sql  esquema PostgreSQL basado en el diagrama de clases
├── docs/                contexto, requisitos, casos de uso, escenarios, diagramas, glosario
├── .github/             CI, plantillas de issues y de pull request
└── docker-compose.yml   postgres + backend + frontend
```

## Arrancar en local

Requisitos: **Node.js 20.12 o superior** (recomendado 22) y npm.

```bash
git clone https://github.com/Camello15/padre-julian-lorente-carga-devs.git
cd padre-julian-lorente-carga-devs
git switch develop
npm install
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:3000/api/salud

En la pantalla de ingreso elige un **rol de prueba** (PMO, Técnico o Administrativo) y pulsa *Ingresar con SSO de la cooperativa*. El rol Técnico entra como "Andrea Torres" y solo ve su propia carga.

No hace falta un archivo `.env` para empezar. Si quieres cambiar algo (umbral, porcentajes de avance, simular la caída de una fuente), copia `.env.example` a `.env`.

### ChromeOS (Linux en Chromebook)

Abre http://localhost:5173 en Chrome. ChromeOS reenvía automáticamente los puertos del contenedor Linux. Si no carga, ve a *Configuración → Desarrolladores → Entorno de desarrollo de Linux → Reenvío de puertos* y agrega el puerto 5173.

### Comandos

| Comando (desde la raíz) | Qué hace |
|---|---|
| `npm run dev` | Backend y frontend en modo desarrollo |
| `npm run lint` | ESLint en los dos proyectos |
| `npm test` | Pruebas (node:test en backend, Vitest en frontend) |
| `npm run test:cobertura` | Pruebas con reporte de cobertura (lcov) |
| `npm run build` | Build de producción del frontend |

### Con Docker

```bash
cp .env.example .env      # define POSTGRES_PASSWORD
docker compose up --build
```

Web en http://localhost:8080, API en http://localhost:3000. PostgreSQL arranca con `database/schema.sql`; el backend conserva el almacén en memoria como caché y, cuando `DATABASE_URL` está configurada, PostgreSQL es obligatorio para persistir ejecuciones, fallos, snapshots y cursores.

Si el volumen de PostgreSQL ya estaba inicializado antes de añadir `snapshot_fuente`, aplica la migración antes de iniciar el backend:

```bash
docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < database/migrations/001-snapshot-fuente.sql
```

La migración no elimina ni recrea tablas existentes. En una base nueva, `database/schema.sql` crea la tabla automáticamente.

## API

Todas las rutas, salvo `/api/salud` y `/api/auth/login`, exigen la cabecera `Authorization: Bearer <token>`.

| Método y ruta | Descripción |
|---|---|
| `POST /api/auth/login` | SSO simulado. Cuerpo: `{ "rol": "PMO" \| "TECNICO" \| "ADMINISTRATIVO" }` |
| `GET /api/carga` | Indicadores de carga por desarrollador y resumen |
| `GET /api/peticiones` | Peticiones con su etapa y avance |
| `GET /api/alertas` | Alertas por superar el umbral |
| `GET /api/sincronizacion/estado` | Última sincronización y estado de cada fuente |
| `GET /api/catalogos` | Opciones de los filtros |

`/api/carga` y `/api/peticiones` aceptan los filtros de RF-11: `desarrollador`, `tipo` (`POA`, `REC`, `INICIATIVA`, `INCIDENTE`), `proyecto`, `modulo`, `desde` y `hasta` (`AAAA-MM-DD`). Con el rol Técnico, el filtro de desarrollador siempre es el propio.

## Avance por etapa

RedMine no registra el avance real, así que se estima según la etapa: Análisis 10 %, Desarrollo 40 %, Certificación 70 %, Despliegue 90 % y Estabilización 100 %. **Es una propuesta del equipo, pendiente de validar con la cooperativa.** Se cambia con la variable `AVANCE_POR_ETAPA` (ver `.env.example`).

## Integración continua

El workflow `.github/workflows/ci.yml` corre en cada push y pull request a `develop` y `main`:

1. Instala las dependencias de backend y frontend (`npm ci`).
2. Lint y pruebas con cobertura.
3. Análisis con **SonarQube Cloud** (acción oficial `SonarSource/sonarqube-scan-action`). Se omite con un aviso mientras no exista el secreto `SONAR_TOKEN`.
4. Build de las imágenes Docker de backend y frontend.

### Configurar SonarQube Cloud (una sola vez, lo hace el dueño del repo)

1. Entra a https://sonarcloud.io y pulsa **Log in → GitHub**. Autoriza con la cuenta `Camello15`.
2. Pulsa **+ → Create new organization → Import an organization from GitHub**. Elige tu cuenta personal `Camello15` e instala la app de SonarQube Cloud solo para el repositorio `padre-julian-lorente-carga-devs`.
3. Elige el plan **Free** (los repositorios públicos son gratis). Anota la **Organization key** (suele ser `camello15`).
4. Pulsa **+ → Analyze new project**, marca `padre-julian-lorente-carga-devs` y pulsa **Set up**. Para "new code", elige **Previous version**.
5. En el proyecto, ve a **Administration → Analysis Method** y **desactiva Automatic Analysis**. Este repositorio analiza desde GitHub Actions para enviar la cobertura.
6. En la misma página, elige **With GitHub Actions**. SonarQube Cloud te mostrará un **SONAR_TOKEN**. Cópialo; no lo pegues en ningún archivo.
7. En GitHub: **Settings → Secrets and variables → Actions → New repository secret**. Nombre: `SONAR_TOKEN`; valor: el token del paso anterior.
8. Revisa que `sonar.organization` y `sonar.projectKey` en `sonar-project.properties` coincidan con lo que muestra SonarQube Cloud (**Information** del proyecto). Si no coinciden, corrígelos.
9. Vuelve a ejecutar el workflow (Actions → CI → Re-run) y revisa el resultado en SonarQube Cloud.

### Llevar el pipeline a GitLab CI

La cooperativa usa GitLab. El siguiente ejemplo reproduce las validaciones y el análisis de este repositorio. Guárdalo como `.gitlab-ci.yml` en la raíz:

```yaml
stages:
  - validar
  - calidad
  - imagenes

variables:
  # Se necesita el historial completo para que SonarQube atribuya los cambios.
  GIT_DEPTH: "0"

validar:
  stage: validar
  image: node:22
  script:
    - npm ci
    - npm run lint
    - npm run test:cobertura
    # Los reportes de los workspaces usan rutas relativas a src/.
    # Se prefijan para que coincidan con sonar.sources en sonar-project.properties.
    - sed -i 's#^SF:src/#SF:backend/src/#' backend/coverage/lcov.info
    - sed -i 's#^SF:src/#SF:frontend/src/#' frontend/coverage/lcov.info
  artifacts:
    when: always
    paths:
      - backend/coverage/lcov.info
      - frontend/coverage/lcov.info
    expire_in: 1 day

sonar:
  stage: calidad
  image:
    name: sonarsource/sonar-scanner-cli:latest
    entrypoint: [""]
  needs:
    - job: validar
      artifacts: true
  script:
    # Un token protegido no está disponible en todos los pipelines, por ejemplo
    # los de forks. En ese caso se omite el análisis de forma explícita.
    - |
      if [ -z "$SONAR_TOKEN" ]; then
        echo "SONAR_TOKEN no disponible; se omite el análisis de SonarQube Cloud."
      else
        sonar-scanner -Dsonar.qualitygate.wait=true
      fi
  allow_failure: false
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'
    - if: '$CI_COMMIT_BRANCH'

construir-imagenes:
  stage: imagenes
  image: docker:27.5.1-cli
  services:
    - name: docker:27.5.1-dind
      alias: docker
  variables:
    DOCKER_HOST: tcp://docker:2376
    DOCKER_TLS_CERTDIR: /certs
    DOCKER_TLS_VERIFY: "1"
    DOCKER_CERT_PATH: "$DOCKER_TLS_CERTDIR/client"
  needs:
    - sonar
  script:
    - docker info
    - docker build -f backend/Dockerfile -t padre-julian-lorente-carga-devs-backend:$CI_COMMIT_SHA .
    - docker build -f frontend/Dockerfile -t padre-julian-lorente-carga-devs-frontend:$CI_COMMIT_SHA .
```

`npm ci`, `npm run lint` y `npm run test:cobertura` son los scripts definidos en el `package.json` raíz y sus workspaces `backend` y `frontend`. Las pruebas generan `backend/coverage/lcov.info` y `frontend/coverage/lcov.info`; el job `validar` conserva ambos como artefactos y el job `sonar` los descarga antes del análisis. El paso `sed` replica el ajuste de rutas del workflow de GitHub Actions. El scanner se ejecuta desde la raíz, por lo que lee `sonar-project.properties` sin duplicar sus parámetros (`sonar.sources`, exclusiones y `sonar.javascript.lcov.reportPaths`). Mantén sincronizados esos paths si cambia la ubicación de los reportes.

En GitLab, configura `SONAR_TOKEN` en *Settings → CI/CD → Variables*: utiliza un token creado para el proyecto en SonarQube Cloud y marca la variable como **Masked** y **Protected**. No lo escribas en `.gitlab-ci.yml` ni en el repositorio. Las versiones actuales de SonarScanner CLI se conectan a SonarQube Cloud por defecto; si fijas una versión anterior a la 6.0, configura además `SONAR_HOST_URL=https://sonarcloud.io`. Comprueba que `sonar.organization` y `sonar.projectKey` en `sonar-project.properties` correspondan a una organización y proyecto creados en SonarQube Cloud. El proyecto debe estar vinculado al repositorio GitLab para que SonarQube Cloud pueda publicar la decoración del merge request. La creación y vinculación son pasos externos y no quedan realizadas por este archivo.

La publicación del estado y la espera del Quality Gate son cosas distintas. La integración de SonarQube Cloud con GitLab publica el resultado en el merge request cuando el proyecto está vinculado y el análisis reconoce el merge request. En el ejemplo, `-Dsonar.qualitygate.wait=true` hace que `sonar-scanner` espere el resultado y falle si el Quality Gate no se aprueba; así, el job y el pipeline fallan. Si solo se desea publicar el estado sin bloquear el pipeline, elimina ese parámetro. Para impedir merges cuando falle el gate, habilita también en GitLab la comprobación de que los pipelines deban tener éxito.

El análisis omite de forma explícita los pipelines donde `SONAR_TOKEN` no está disponible. GitLab no entrega variables protegidas a todas las ramas y solicitudes, especialmente a contribuciones desde forks; en esos casos se ejecutarán las validaciones, pero no habrá análisis ni estado de Quality Gate. No desprotejas el token ni lo expongas a código externo para evitar ese límite. Si se habilita el acceso a variables protegidas en merge requests, limita esa opción a los refs de confianza conforme a la política del repositorio.

El job `construir-imagenes` es opcional: requiere un runner Docker con executor Docker, modo privilegiado y soporte de Docker-in-Docker con certificados TLS compartidos en `/certs/client`. Si el runner no tiene esa configuración, elimina el job o usa un runner que la tenga. El ejemplo solo construye las imágenes; no las publica en un registry. La etiqueta `latest` del scanner puede sustituirse por una versión fijada que el equipo haya validado.

## Documentación

Toda la documentación está en [`docs/`](docs/README.md). Las reglas para colaborar (ramas, commits, pull requests) están en [CONTRIBUTING.md](CONTRIBUTING.md).
