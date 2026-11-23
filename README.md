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
│   ├── src/datos/           avance por etapa, carga, umbral, filtros, alertas, almacén (memoria o PostgreSQL)
│   ├── src/auth/            SSO simulado y roles (PMO, Técnico, Administrativo, Administrador TI)
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

En la pantalla de ingreso elige un **rol de prueba** (PMO, Técnico, Administrativo o Administrador TI) y pulsa *Ingresar con SSO de la cooperativa*. El rol Técnico entra como "Andrea Torres" y solo ve su propia carga. Solo el Administrador TI ve el panel para cambiar el umbral y revisar los registros no reconocidos.

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

### Con Docker (recomendado para evaluar)

Requisitos: Docker con Docker Compose v2. No hace falta Node.js ni un archivo `.env`.

```bash
git clone https://github.com/Camello15/padre-julian-lorente-carga-devs.git
cd padre-julian-lorente-carga-devs
docker compose up --build
```

| Servicio | URL | Qué es |
|---|---|---|
| frontend | http://localhost:8080 | Dashboard (nginx; reenvía `/api` al backend) |
| backend | http://localhost:3000/api/salud | API; debe responder `{"estado":"ok"}` |
| postgres | `localhost:5432` (solo desde tu equipo) | Base `carga_devs`, usuario `carga_devs`, contraseña `carga_devs_local` |

Al crear la base, PostgreSQL ejecuta `database/schema.sql` y el backend se conecta solo (`DATABASE_URL` está definida en `docker-compose.yml`). Al arrancar, el backend hace la primera sincronización con los datos de prueba. Ver [Persistencia](#persistencia).

Para cambiar la contraseña de la base, el umbral u otras variables, copia `.env.example` a `.env` y edítalo antes de levantar. Para detener todo: `docker compose down` (conserva los datos) o `docker compose down -v` (borra también la base).

> **¿Ya habías levantado Docker antes de esta versión?** `schema.sql` solo se ejecuta cuando se crea el volumen de la base, así que tu base tiene el esquema viejo. Elige una opción:
>
> **A. Borrar la base y empezar de cero** (se pierden los datos de prueba guardados):
>
> ```bash
> docker compose down -v
> docker compose up --build
> ```
>
> **B. Conservar la base y aplicar las migraciones** en orden, antes de iniciar el backend. No eliminan ni recrean tablas:
>
> ```bash
> docker compose up -d postgres
> docker compose exec -T postgres sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < database/migrations/001-snapshot-fuente.sql
> docker compose exec -T postgres sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < database/migrations/002-persistencia-datos.sql
> docker compose up --build
> ```

## Persistencia

| `DATABASE_URL` | Dónde se guardan los datos |
|---|---|
| vacía (por defecto en `npm run dev`) | En memoria (`AlmacenMemoria`). Se pierden al reiniciar. |
| definida (Docker la define sola) | En PostgreSQL. Es obligatorio: si no está disponible, el backend no arranca. |

Con PostgreSQL, dos componentes comparten el mismo pool de conexiones. La memoria sigue como caché de lectura, así que las rutas no cambian.

| Componente | Módulo | Tablas que escribe |
|---|---|---|
| `RepositorioSincronizacionPostgres` | Integración | `sincronizacion`, `registro_fallo`, `snapshot_fuente` (datos y cursor de cada fuente) |
| `AlmacenPostgres` | Datos y alertas | `desarrollador`, `usuario`, `proyecto`, `peticion`, `modulo_core`, `peticion_modulo`, `actividad_codigo`, `indicador_carga`, `alerta`, `umbral`, `registro_no_reconocido` |

Al arrancar se recuperan el umbral configurado por el Administrador TI, los snapshots y cursores de cada fuente (RNF-01), las revisiones de registros no reconocidos, el estado de la última sincronización y las alertas ya enviadas a Rocket Chat. Con `USAR_MOCKS=true` (por defecto) los snapshots no se guardan, porque los datos de prueba se leen de nuevo en cada sincronización. El SSO sigue simulado.

Para usar PostgreSQL con `npm run dev`, levanta solo la base (`docker compose up -d postgres`) y en `.env` pon `DATABASE_URL=postgres://carga_devs:carga_devs_local@localhost:5432/carga_devs`.

### Pruebas de integración con PostgreSQL

`backend/test/almacen-postgres.test.js` se omite si no existe `TEST_DATABASE_URL`. Cada ejecución crea un schema temporal con `database/schema.sql` y lo borra al terminar. En el CI corren siempre contra un servicio de PostgreSQL.

```bash
docker run -d --rm --name pg-pruebas -e POSTGRES_PASSWORD=prueba -p 55432:5432 postgres:17-alpine
TEST_DATABASE_URL=postgres://postgres:prueba@localhost:55432/postgres npm test
docker stop pg-pruebas
```

## API

Todas las rutas, salvo `/api/salud` y `/api/auth/login`, exigen la cabecera `Authorization: Bearer <token>`.

| Método y ruta | Descripción |
|---|---|
| `POST /api/auth/login` | SSO simulado. Cuerpo: `{ "rol": "PMO" \| "TECNICO" \| "ADMINISTRATIVO" \| "ADMINISTRADOR_TI" }` |
| `GET /api/carga` | Indicadores de carga por desarrollador y resumen |
| `GET /api/peticiones` | Peticiones con su etapa y avance |
| `GET /api/alertas` | Alertas por superar el umbral |
| `GET /api/sincronizacion/estado` | Última sincronización y estado de cada fuente |
| `GET /api/catalogos` | Opciones de los filtros |
| `PUT /api/umbral` | Cambia el umbral (`{ "maxPeticiones": 6 }`). Solo Administrador TI |
| `GET /api/registros-no-reconocidos` | Registros pendientes de revisión (`?todos=true` incluye los revisados). Solo Administrador TI |
| `PATCH /api/registros-no-reconocidos/:id` | Marca un registro como revisado (`{ "peticionCodigo": "POA-001" }` opcional). Solo Administrador TI |

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
