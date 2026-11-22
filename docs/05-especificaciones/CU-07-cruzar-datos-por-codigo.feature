# language: es
# Responsable: Bryan. Requisitos: RF-06, RF-07, RF-09. Incluido por CU-05.
Característica: CU-07 Cruzar datos por código
  Como programador de tareas
  Quiero relacionar los datos de RedMine, GLPI y GitLab mediante el código de una Petición
  Para unificarlos, clasificarlos y reconocer los módulos del core con cambios

  Esquema del escenario: Extraer y normalizar códigos de Petición
    Dado que una fuente contiene el texto "<texto>"
    Cuando el sistema extrae el código de Petición
    Entonces obtiene "<codigo>"

    Ejemplos:
      | texto                         | codigo             |
      | rama/POA-2026-001             | POA-2026-001       |
      | rama/poa-2026-001             | POA-2026-001       |
      | rama/REC-2026-014             | REC-2026-014       |
      | rama/inc-2026-031             | INC-2026-031       |
      | rama/INICIATIVA.TI.001        | iniciativa.ti.001  |

  Escenario: Cruzar una Petición de RedMine con GLPI y GitLab
    Dado que RedMine contiene la Petición "INC-2026-031" con tipo "INCIDENTE" y etapa "Desarrollo"
    Y el campo RedMine "Módulo del core" de la Petición contiene "Cajas"
    Y GLPI contiene un incidente cuyo nombre incluye "INC-2026-031"
    Y GitLab contiene una actividad cuya rama incluye "INC-2026-031"
    Cuando el sistema unifica los datos de las fuentes
    Entonces la Petición se conserva una sola vez con datos de RedMine
    Y la Petición queda relacionada con los registros coincidentes de GLPI y GitLab
    Y "Cajas" se incluye en "modulosConCambios" porque la Petición tiene actividad GitLab asociada

  Escenario: Usar el título de GitLab cuando la rama no contiene código
    Dado que RedMine contiene la Petición "REC-2026-014"
    Y GitLab contiene una actividad cuya rama no incluye código y cuyo título incluye "rec-2026-014"
    Cuando el sistema unifica los datos de las fuentes
    Entonces la actividad queda asociada a la Petición "REC-2026-014"
    Y el código extraído se normaliza como "REC-2026-014"

  Escenario: Eliminar peticiones duplicadas de RedMine
    Dado que RedMine contiene dos registros con el código "INC-2026-031"
    Y ambos registros superan la validación de código, tipo y etapa
    Cuando el sistema unifica los datos de las fuentes
    Entonces el resultado contiene una sola Petición con ese código
    Y se conserva el primer registro encontrado

  Escenario: Registrar datos que no pueden cruzarse
    Dado que RedMine contiene un registro sin código válido
    Y GLPI contiene un incidente cuyo código no corresponde a ninguna Petición de RedMine
    Y GitLab contiene una actividad cuya rama y título no incluyen el código de una Petición conocida
    Cuando el sistema unifica los datos de las fuentes
    Entonces cada dato no reconocido queda en "RegistroNoReconocido"
    Y cada registro incluye la fuente, el código original o identificador, el motivo, la fecha de detección y "revisado = false"

  Escenario: Guardar la rama como codigoOriginal cuando el código de GitLab solo aparece en el título
    Dado que RedMine contiene la Petición "POA-2026-001" pero no la Petición "INC-2026-031"
    Y GitLab contiene una actividad cuya rama es "feature/sin-codigo" y cuyo título incluye "INC-2026-031"
    Cuando el sistema unifica los datos de las fuentes
    Entonces el sistema extrae "INC-2026-031" del título como alternativa a la rama
    Y crea un "RegistroNoReconocido" para la actividad de GitLab
    Y el valor de "codigoOriginal" es "feature/sin-codigo"

  Escenario: Registrar peticiones de RedMine con tipo desconocido o etapa inválida
    Dado que RedMine contiene una Petición con código válido y tipo de trabajo desconocido
    Y RedMine contiene otra Petición con código válido y una etapa fuera del catálogo
    Cuando el sistema unifica los datos de las fuentes
    Entonces cada registro se agrega a "RegistroNoReconocido"
    Y el motivo indica tipo de trabajo desconocido para la primera Petición
    Y el motivo indica etapa no válida para la segunda Petición

  Escenario: No crear registros no reconocidos por mensajes de Rocket Chat
    Dado que Rocket Chat contiene un mensaje sin código de Petición reconocida
    Cuando el sistema unifica los datos de las fuentes
    Entonces el mensaje no se agrega a "RegistroNoReconocido"
    Y el mensaje no aparece entre las notificaciones vinculadas a Peticiones reconocidas
