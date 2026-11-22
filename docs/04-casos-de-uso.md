# 4. Casos de uso

## Actores

| Actor | Descripción |
|---|---|
| PMO | Persona de proyectos. Ve la carga de todo el equipo y exporta reportes. |
| Usuario técnico | Desarrollador. Solo ve su propia carga. |
| Usuario administrativo | Personal administrativo que consulta la carga del equipo. |
| Administrador TI | Configura el umbral y revisa los registros no reconocidos. |
| Programador de tareas (cron) | Dispara la sincronización cada 15 minutos. |
| SSO de la cooperativa | Autentica a los usuarios. |
| Fuentes | RedMine, GitLab, GLPI y Rocket Chat. |

## Lista de casos de uso

| ID | Caso de uso | Actor | Módulo | Responsable |
|---|---|---|---|---|
| CU-01 | Iniciar sesión con SSO | PMO, usuarios | Usuario web y seguridad | Camilo |
| CU-02 | Filtrar información | PMO, usuarios | Usuario web y seguridad | Camilo |
| CU-03 | Consultar dashboard de carga y avance | PMO, usuarios | Usuario web y seguridad | Camilo |
| CU-04 | Exportar reporte | PMO | Usuario web y seguridad | Camilo |
| CU-05 | Sincronizar fuentes | Programador de tareas (cron) | Integración | Bryan |
| CU-06 | Registrar fallo de fuente | Programador de tareas | Integración | Bryan |
| CU-07 | Cruzar datos por código | Programador de tareas | Integración | Bryan |
| CU-08 | Calcular carga y avance | Programador de tareas | Datos y alertas | Cristina |
| CU-09 | Enviar alerta | Programador de tareas | Datos y alertas | Cristina |
| CU-10 | Configurar umbral | Administrador TI | Datos y alertas | Cristina |
| CU-11 | Revisar registros no reconocidos | Administrador TI | Datos y alertas | Cristina |

## Relaciones

| Relación | Tipo |
|---|---|
| CU-02 Filtrar información → CU-01 Iniciar sesión con SSO | «include» |
| CU-03 Consultar dashboard → CU-01 Iniciar sesión con SSO | «include» |
| CU-04 Exportar reporte → CU-01 Iniciar sesión con SSO | «include» |
| CU-03 Consultar dashboard → CU-02 Filtrar información | «include» |
| CU-04 Exportar reporte → CU-03 Consultar dashboard | «extend» |
| CU-05 Sincronizar fuentes → CU-07 Cruzar datos por código | «include» |
| CU-05 Sincronizar fuentes → CU-08 Calcular carga y avance | «include» |
| CU-06 Registrar fallo de fuente → CU-05 Sincronizar fuentes | «extend» |
| CU-09 Enviar alerta → CU-08 Calcular carga y avance | «extend» |

```mermaid
flowchart LR
    PMO(["PMO"]) & USR(["Usuarios"]) --> CU03
    PMO --> CU04
    CRON(["Programador de tareas"]) --> CU05
    ADM(["Administrador TI"]) --> CU10 & CU11
    CU02["CU-02 Filtrar información"] -. include .-> CU01["CU-01 Iniciar sesión con SSO"]
    CU03["CU-03 Consultar dashboard"] -. include .-> CU01
    CU04["CU-04 Exportar reporte"] -. include .-> CU01
    CU03 -. include .-> CU02
    CU04 -. extend .-> CU03
    CU05["CU-05 Sincronizar fuentes"] -. include .-> CU07["CU-07 Cruzar datos por código"]
    CU05 -. include .-> CU08["CU-08 Calcular carga y avance"]
    CU06["CU-06 Registrar fallo de fuente"] -. extend .-> CU05
    CU09["CU-09 Enviar alerta"] -. extend .-> CU08
    CU10["CU-10 Configurar umbral"]
    CU11["CU-11 Revisar registros no reconocidos"]
    CU01 --- SSO(["SSO de la cooperativa"])
    CU05 --- FUE(["Fuentes"])
```

## Fichas de casos de uso

Cada responsable completa la ficha de sus casos de uso. Los escenarios en Gherkin están en [`05-especificaciones/`](05-especificaciones/).

### CU-01 Iniciar sesión con SSO

> Responsable: **Camilo**. Módulo: Usuario web y seguridad. Escenarios: [`CU-01-iniciar-sesion-sso.feature`](05-especificaciones/CU-01-iniciar-sesion-sso.feature)

| Campo | Contenido |
|---|---|
| **ID** | CU-01 |
| **Nombre** | Iniciar sesión con SSO |
| **Actores** | PMO, usuarios; SSO de la cooperativa |
| **Descripción** | |
| **Precondiciones** | |
| **Flujo principal** | 1. <br>2. <br>3. |
| **Flujos alternativos** | |
| **Excepciones** | |
| **Postcondiciones** | |
| **Requisitos relacionados** | |

### CU-02 Filtrar información

> Responsable: **Camilo**. Módulo: Usuario web y seguridad. Escenarios: [`CU-02-filtrar-informacion.feature`](05-especificaciones/CU-02-filtrar-informacion.feature)

| Campo | Contenido |
|---|---|
| **ID** | CU-02 |
| **Nombre** | Filtrar información |
| **Actores** | PMO, usuarios |
| **Descripción** | |
| **Precondiciones** | |
| **Flujo principal** | 1. <br>2. <br>3. |
| **Flujos alternativos** | |
| **Excepciones** | |
| **Postcondiciones** | |
| **Requisitos relacionados** | |

### CU-03 Consultar dashboard de carga y avance

> Responsable: **Camilo**. Módulo: Usuario web y seguridad. Escenarios: [`CU-03-consultar-dashboard.feature`](05-especificaciones/CU-03-consultar-dashboard.feature)

| Campo | Contenido |
|---|---|
| **ID** | CU-03 |
| **Nombre** | Consultar dashboard de carga y avance |
| **Actores** | PMO, usuarios |
| **Descripción** | |
| **Precondiciones** | |
| **Flujo principal** | 1. <br>2. <br>3. |
| **Flujos alternativos** | |
| **Excepciones** | |
| **Postcondiciones** | |
| **Requisitos relacionados** | |

### CU-04 Exportar reporte

> Responsable: **Camilo**. Módulo: Usuario web y seguridad. Escenarios: [`CU-04-exportar-reporte.feature`](05-especificaciones/CU-04-exportar-reporte.feature)

| Campo | Contenido |
|---|---|
| **ID** | CU-04 |
| **Nombre** | Exportar reporte |
| **Actores** | PMO |
| **Descripción** | |
| **Precondiciones** | |
| **Flujo principal** | 1. <br>2. <br>3. |
| **Flujos alternativos** | |
| **Excepciones** | |
| **Postcondiciones** | |
| **Requisitos relacionados** | |

### CU-05 Sincronizar fuentes

> Responsable: **Bryan**. Módulo: Integración. Escenarios: [`CU-05-sincronizar-fuentes.feature`](05-especificaciones/CU-05-sincronizar-fuentes.feature)

| Campo | Contenido |
|---|---|
| **ID** | CU-05 |
| **Nombre** | Sincronizar fuentes |
| **Actores** | Programador de tareas (cron); Fuentes |
| **Descripción** | Lee RedMine, GitLab, GLPI y Rocket Chat como fuentes. Cruza las Peticiones de RedMine con incidentes de GLPI y actividades de GitLab; Rocket Chat aporta notificaciones vinculadas por código a Peticiones reconocidas. Actualiza datos e indicadores cada 15 minutos. |
| **Precondiciones** | El programador de tareas tiene una expresión cron válida y los conectores de las fuentes están registrados. |
| **Flujo principal** | 1. El programador de tareas dispara la sincronización según la expresión cron.<br>2. El sistema lee RedMine, GitLab, GLPI y Rocket Chat en paralelo y conserva los datos recibidos por cada conector.<br>3. El sistema cruza las Peticiones de RedMine con GLPI y GitLab, obtiene notificaciones de Rocket Chat que mencionan códigos reconocidos (CU-07), calcula carga y avance (CU-08), genera las alertas correspondientes y guarda el resultado con estado global `ok` si ninguna fuente falla. |
| **Flujos alternativos** | **FA-01 (Falla una o más fuentes):** Tras agotar tres intentos, CU-06 registra cada fallo y la sincronización continúa con los últimos datos exitosos disponibles en memoria para esa fuente; si no existen, continúa con una lista vacía. El estado global queda `parcial` si falló parte de las fuentes o `fallida` si fallaron todas.<br>**FA-02 (Ya hay una sincronización en ejecución):** El sistema no inicia otra ejecución y devuelve `null`. |
| **Excepciones** | No se especifican excepciones de negocio adicionales. |
| **Postcondiciones** | Al terminar la ejecución se guarda el estado global (`ok`, `parcial` o `fallida`), los datos unificados, indicadores, alertas y la cantidad de registros no reconocidos. |
| **Requisitos relacionados** | RF-02, RF-03, RF-04, RF-05, RF-06, RF-07, RF-08, RF-09, RF-10, RF-12, RNF-01, RNF-04. Incluye CU-07 y CU-08; CU-06 extiende este caso. |

### CU-06 Registrar fallo de fuente

> Responsable: **Bryan**. Módulo: Integración. Escenarios: [`CU-06-registrar-fallo-fuente.feature`](05-especificaciones/CU-06-registrar-fallo-fuente.feature)

| Campo | Contenido |
|---|---|
| **ID** | CU-06 |
| **Nombre** | Registrar fallo de fuente |
| **Actores** | Programador de tareas |
| **Descripción** | Registra el fallo de una Fuente cuando su Conector no logra leerla después de tres intentos y permite que CU-05 continúe usando los últimos datos exitosos disponibles en el almacén en memoria. |
| **Precondiciones** | CU-05 está leyendo las fuentes y el Conector de una Fuente ha agotado los tres intentos de lectura. |
| **Flujo principal** | 1. El sistema obtiene el último error de lectura de la Fuente y el número de intentos realizados.<br>2. Registra la Fuente, fecha, número de intentos y mensaje del error en `estadoSincronizacion.fallos`.<br>3. Recupera los últimos datos exitosos disponibles de esa Fuente en el almacén en memoria y los entrega a CU-05 para continuar la sincronización. |
| **Flujos alternativos** | **FA-01 (Sin datos anteriores):** Si no existe una lectura exitosa previa en el almacén en memoria, CU-05 continúa con una lista vacía para esa Fuente y la marca `sin-datos`; este es un estado individual de la Fuente, no el estado global de sincronización. |
| **Excepciones** | No se especifican excepciones de negocio adicionales. |
| **Postcondiciones** | El fallo queda incluido en `estadoSincronizacion.fallos` y se reutilizan los últimos datos exitosos disponibles en memoria; si no existen, la Fuente aporta cero registros a esa ejecución. La recuperación depende de los datos disponibles en memoria del proceso. |
| **Requisitos relacionados** | RNF-01. Extiende CU-05. |

### CU-07 Cruzar datos por código

> Responsable: **Bryan**. Módulo: Integración. Escenarios: [`CU-07-cruzar-datos-por-codigo.feature`](05-especificaciones/CU-07-cruzar-datos-por-codigo.feature)

| Campo | Contenido |
|---|---|
| **ID** | CU-07 |
| **Nombre** | Cruzar datos por código |
| **Actores** | Programador de tareas |
| **Descripción** | Extrae códigos de Petición (`POA-AAAA-NNN`, `REC-AAAA-NNN`, `INC-AAAA-NNN` e `iniciativa.ti.NNN`) sin distinguir mayúsculas y minúsculas; normaliza los tres formatos estándar a mayúsculas e `iniciativa.ti` a minúsculas. Usa el código para cruzar RedMine con GLPI y GitLab, eliminar duplicados y separar datos no reconocidos. En GitLab busca primero en la rama y, si no encuentra código, en el título. |
| **Precondiciones** | CU-05 obtuvo los datos disponibles de las fuentes y los desarrolladores están disponibles para relacionar sus identificadores de origen. |
| **Flujo principal** | 1. El sistema normaliza las peticiones de RedMine y valida código, tipo de trabajo y etapa; si hay duplicados, conserva el primer registro que supera las tres validaciones.<br>2. Cruza los incidentes de GLPI y las actividades de GitLab con las peticiones por código, relacionando los desarrolladores cuando hay coincidencia. Para GitLab busca primero en la rama y luego en el título si la rama no contiene código.<br>3. Obtiene de RedMine el campo `Módulo del core`; incluye sus módulos en `modulosConCambios` solo para peticiones con actividad GitLab asociada. Devuelve también las notificaciones de Rocket Chat que mencionan códigos reconocidos. |
| **Flujos alternativos** | **FA-01 (Registro no reconocido):** Se crea `RegistroNoReconocido` si RedMine tiene código inválido o ausente, tipo desconocido o etapa inválida; si GLPI no tiene código o este no corresponde a una Petición; o si GitLab no permite extraer un código o el código extraído no corresponde a una Petición. El registro incluye fuente, `codigoOriginal`, motivo, fecha de detección y `revisado = false`. En RedMine, `codigoOriginal` es el texto del campo Código o `redmine#id` si no existe; en GLPI, es el código o `glpi#id` si no existe; en GitLab, es el nombre de la rama incluso si el código se extrajo del título. Los mensajes de Rocket Chat sin Petición coincidente no generan `RegistroNoReconocido`. |
| **Excepciones** | No se especifican excepciones de negocio adicionales. |
| **Postcondiciones** | Se devuelven peticiones unificadas sin duplicados, proyectos, módulos del core con cambios, notificaciones coincidentes y registros no reconocidos para revisión (CU-11). |
| **Requisitos relacionados** | RF-06, RF-07, RF-09. Es incluido por CU-05; los registros no reconocidos quedan disponibles para CU-11. |

### CU-08 Calcular carga y avance

> Responsable: **Cristina**. Módulo: Datos y alertas. Escenarios: [`CU-08-calcular-carga-avance.feature`](05-especificaciones/CU-08-calcular-carga-avance.feature)

| Campo | Contenido |
|---|---|
| **ID** | CU-08 |
| **Nombre** | Calcular carga y avance |
| **Actores** | Programador de tareas |
| **Descripción** | |
| **Precondiciones** | |
| **Flujo principal** | 1. <br>2. <br>3. |
| **Flujos alternativos** | |
| **Excepciones** | |
| **Postcondiciones** | |
| **Requisitos relacionados** | |

### CU-09 Enviar alerta

> Responsable: **Cristina**. Módulo: Datos y alertas. Escenarios: [`CU-09-enviar-alerta.feature`](05-especificaciones/CU-09-enviar-alerta.feature)

| Campo | Contenido |
|---|---|
| **ID** | CU-09 |
| **Nombre** | Enviar alerta |
| **Actores** | Programador de tareas |
| **Descripción** | |
| **Precondiciones** | |
| **Flujo principal** | 1. <br>2. <br>3. |
| **Flujos alternativos** | |
| **Excepciones** | |
| **Postcondiciones** | |
| **Requisitos relacionados** | |

### CU-10 Configurar umbral

> Responsable: **Cristina**. Módulo: Datos y alertas. Escenarios: [`CU-10-configurar-umbral.feature`](05-especificaciones/CU-10-configurar-umbral.feature)

| Campo | Contenido |
|---|---|
| **ID** | CU-10 |
| **Nombre** | Configurar umbral |
| **Actores** | Administrador TI |
| **Descripción** | |
| **Precondiciones** | |
| **Flujo principal** | 1. <br>2. <br>3. |
| **Flujos alternativos** | |
| **Excepciones** | |
| **Postcondiciones** | |
| **Requisitos relacionados** | |

### CU-11 Revisar registros no reconocidos

> Responsable: **Cristina**. Módulo: Datos y alertas. Escenarios: [`CU-11-revisar-registros-no-reconocidos.feature`](05-especificaciones/CU-11-revisar-registros-no-reconocidos.feature)

| Campo | Contenido |
|---|---|
| **ID** | CU-11 |
| **Nombre** | Revisar registros no reconocidos |
| **Actores** | Administrador TI |
| **Descripción** | |
| **Precondiciones** | |
| **Flujo principal** | 1. <br>2. <br>3. |
| **Flujos alternativos** | |
| **Excepciones** | |
| **Postcondiciones** | |
| **Requisitos relacionados** | |
