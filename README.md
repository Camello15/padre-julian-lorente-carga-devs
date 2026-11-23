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

> **¿Ya habías levantado Docker antes de esta versión?** `schema.sql` solo se ejecuta cuando se crea el volumen de la base, así que tu base tiene el esquema viejo. Bórrala una vez (se pierden los datos de prueba guardados) y vuelve a levantar:
>
> ```bash
> docker compose down -v
> docker compose up --build
> ```

## Persistencia

| `DATABASE_URL` | Dónde se guardan los datos |
|---|---|
| vacía (por defecto en `npm run dev`) | En memoria (`AlmacenMemoria`). Se pierden al reiniciar. |
| definida (Docker la define sola) | En PostgreSQL (`AlmacenPostgres`). |

`AlmacenPostgres` mantiene la memoria como caché de lectura (las rutas no cambian) y guarda cada escritura en PostgreSQL en una transacción. Al arrancar recupera el umbral configurado por el Administrador TI, los últimos datos de cada fuente (RNF-01), las revisiones de registros no reconocidos y las alertas ya enviadas a Rocket Chat. El SSO y los conectores siguen en modo simulado hasta tener credenciales reales.

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

La cooperativa usa GitLab. El pipeline se puede llevar **casi igual** a un `.gitlab-ci.yml`: los mismos comandos (`npm ci`, `npm run lint`, `npm run test:cobertura`, `docker build …`) en etapas `test`, `sonar` y `build`. Para SonarQube se usa la imagen `sonarsource/sonar-scanner-cli` con la variable `SONAR_TOKEN` definida en *Settings → CI/CD → Variables* (enmascarada). El archivo `sonar-project.properties` se reutiliza sin cambios.

## Documentación

Toda la documentación está en [`docs/`](docs/README.md). Las reglas para colaborar (ramas, commits, pull requests) están en [CONTRIBUTING.md](CONTRIBUTING.md).
