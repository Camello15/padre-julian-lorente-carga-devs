# language: es
# Responsable: Bryan. Requisitos: RF-06, RF-07, RF-09.
Característica: CU-07 Cruzar datos por código
  Como Programador de tareas (cron)
  Quiero unir los datos de las cuatro fuentes por el código de la petición
  Para tener una sola petición por código, sin duplicados, con su desarrollador y su actividad

  Escenario: Unir GLPI y GitLab con la petición de RedMine
    Dado que RedMine tiene la petición "INC-2026-031" asignada a "Andrea Torres"
    Y GLPI tiene un incidente con el código "INC-2026-031"
    Y GitLab tiene un commit en la rama "hotfix/INC-2026-031-comprobante"
    Cuando se cruzan los datos por código
    Entonces existe una sola petición "INC-2026-031" de tipo "Incidente"
    Y la petición tiene el commit como actividad de código

  Escenario: Un dato sin código reconocido queda para revisión
    Dado que GitLab tiene un commit en la rama "feature/arreglo-rapido"
    Cuando se cruzan los datos por código
    Entonces se guarda un registro no reconocido de la fuente "gitlab" con el código original "feature/arreglo-rapido"
    Y el Administrador TI lo ve en la lista de registros no reconocidos
