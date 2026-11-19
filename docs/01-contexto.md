# 1. Contexto del proyecto

**Proyecto:** Reto 2 – Centralización de la carga de trabajo de los desarrolladores
**Cliente:** Cooperativa de Ahorro y Crédito Padre Julián Lorente (COAC PJL), Loja, Ecuador. Sector financiero.
**Institución:** Universidad Técnica Particular de Loja (UTPL), proyecto académico.

## Equipo

| Integrante | Rol en el equipo | Módulo |
|---|---|---|
| Camilo Velepucha | Frontend y UX | Usuario web y seguridad |
| Bryan Villa | Backend e integración | Integración |
| Cristina Feijo | Datos, alertas y coordinación | Datos y alertas |

## El problema

El área de TI de la cooperativa tiene 1 persona de proyectos (PMO) y 7 desarrolladores. Su trabajo está repartido en 4 herramientas que no se conectan entre sí, todas on-premise en Docker y con API:

| Herramienta | Uso |
|---|---|
| **RedMine** | Peticiones de 4 tipos: POA (proyectos del Plan Operativo Anual), REC (requerimientos), Iniciativas (código propio, ej. `iniciativa.ti.001`) e Incidentes. |
| **GitLab** | Código, merge requests y pipelines, con estrategia Gitflow. |
| **GLPI** | Mesa de ayuda con los incidentes que reportan los usuarios. |
| **Rocket Chat** | Chat interno. También se usa para enviar alertas. |

Hoy nadie ve en un solo lugar cuántas peticiones tiene cada desarrollador, y el cruce se hace a mano.

## La solución

Un prototipo web que lee las 4 herramientas por API cada 15 minutos, unifica los datos por desarrollador y los muestra en un dashboard con carga, avance, filtros, alertas y exportación.

## Decisiones de la cooperativa que se respetan

1. **Integrar por API**, no replicar las herramientas.
2. **No priorizar con algoritmos**: las prioridades cambian por normativas externas.
3. **RedMine no registra el avance real**, solo la planificación. El avance se estima según la etapa: Análisis → Desarrollo → Certificación → Despliegue → Estabilización.
4. Preferencia por **open source y Docker**.
5. **Login con el SSO** (autenticación centralizada) de la cooperativa; no se guardan contraseñas.
6. **Interfaz sencilla**, porque la usa personal técnico y administrativo.

## Situación actual

Por ahora no hay acceso a las APIs reales. La cooperativa va a levantar un RedMine de pruebas. Mientras tanto todo funciona con **datos de prueba (mocks)** y el **SSO se simula**. Los nombres de desarrolladores, proyectos y peticiones del repositorio son ficticios.
