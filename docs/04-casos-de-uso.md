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
| **Descripción** | |
| **Precondiciones** | |
| **Flujo principal** | 1. <br>2. <br>3. |
| **Flujos alternativos** | |
| **Excepciones** | |
| **Postcondiciones** | |
| **Requisitos relacionados** | |

### CU-06 Registrar fallo de fuente

> Responsable: **Bryan**. Módulo: Integración. Escenarios: [`CU-06-registrar-fallo-fuente.feature`](05-especificaciones/CU-06-registrar-fallo-fuente.feature)

| Campo | Contenido |
|---|---|
| **ID** | CU-06 |
| **Nombre** | Registrar fallo de fuente |
| **Actores** | Programador de tareas |
| **Descripción** | |
| **Precondiciones** | |
| **Flujo principal** | 1. <br>2. <br>3. |
| **Flujos alternativos** | |
| **Excepciones** | |
| **Postcondiciones** | |
| **Requisitos relacionados** | |

### CU-07 Cruzar datos por código

> Responsable: **Bryan**. Módulo: Integración. Escenarios: [`CU-07-cruzar-datos-por-codigo.feature`](05-especificaciones/CU-07-cruzar-datos-por-codigo.feature)

| Campo | Contenido |
|---|---|
| **ID** | CU-07 |
| **Nombre** | Cruzar datos por código |
| **Actores** | Programador de tareas |
| **Descripción** | |
| **Precondiciones** | |
| **Flujo principal** | 1. <br>2. <br>3. |
| **Flujos alternativos** | |
| **Excepciones** | |
| **Postcondiciones** | |
| **Requisitos relacionados** | |

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
