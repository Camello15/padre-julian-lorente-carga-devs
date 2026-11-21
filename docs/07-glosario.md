# 7. Glosario

Estos son los nombres que se usan **exactamente igual** en el código y en los documentos.

| Término | Significado | En el código |
|---|---|---|
| **Petición** | Unidad de trabajo registrada en RedMine (POA, REC, Iniciativa o Incidente). No se dice "tarea" ni "ticket". | `Peticion`, `peticion`, `peticiones` |
| **Desarrollador** | Persona del área de TI a la que se asignan peticiones. | `Desarrollador`, `desarrolladorId` |
| **Tipo de trabajo** | Clasificación de la petición: POA, REC, Iniciativa o Incidente. | `TipoTrabajo` |
| **Etapa** | Fase de la petición: Análisis, Desarrollo, Certificación, Despliegue, Estabilización. | `Etapa` |
| **Avance** | Porcentaje estimado según la etapa (RedMine no registra el avance real). | `avance`, `calcularAvance()` |
| **Carga** | Cantidad de peticiones abiertas de un desarrollador. | `IndicadorCarga`, `calcularCarga()` |
| **Umbral** | Máximo de peticiones abiertas antes de generar una alerta. | `Umbral`, `maxPeticiones` |
| **Alerta** | Aviso en pantalla y por Rocket Chat cuando la carga supera el umbral. | `Alerta` |
| **Módulo del core** | Módulo del sistema financiero central afectado por una petición. | `ModuloCore`, `moduloCore` |
| **Fuente** | Herramienta de la que se leen datos: RedMine, GitLab, GLPI, Rocket Chat. | `Fuente` |
| **Conector** | Componente que lee una fuente por su API. | `Conector`, `ConectorRedmine`… |
| **Sincronización** | Lectura periódica (cada 15 min) de todas las fuentes. | `Sincronizacion` |
| **Registro no reconocido** | Dato de una fuente que no se pudo cruzar por código; lo revisa TI. | `RegistroNoReconocido` |
| **SSO** | Inicio de sesión único de la cooperativa (autenticación centralizada). | `auth/sso-mock.js` |
| **Rol** | Perfil del usuario: PMO, Técnico o Administrativo. | `Rol` |
| **Dashboard** | Pantalla principal con carga, avance, filtros y alertas. | `Dashboard.jsx` |
| **Reporte** | Archivo Excel o PDF exportado desde el dashboard. | `Reporte` |

## Convenciones de nombres en el código

- Clases en **PascalCase** y sin tildes: `Peticion`, `RegistroFallo`, `ConectorRedmine`.
- Atributos y métodos en **camelCase**: `desarrolladorId`, `calcularAvance()`.
- Tablas y columnas de la base de datos en **snake_case**: `registro_no_reconocido`, `desarrollador_id`.
- Los textos que ve el usuario sí llevan tildes: "Petición", "Análisis".
