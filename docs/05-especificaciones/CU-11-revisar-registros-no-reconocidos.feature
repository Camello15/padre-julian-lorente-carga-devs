# language: es
# Responsable: Cristina. Requisitos: RF-06.
Característica: CU-11 Revisar registros no reconocidos
  Como Administrador TI
  Quiero visualizar y gestionar los registros provenientes de las fuentes que no pudieron cruzarse por código
  Para corregir su asociación con una petición o descartarlos manteniendo la calidad de los datos

  Escenario: Listar registros no reconocidos tras una sincronización
    Dado que existen commits, merge requests o incidentes sin código válido de petición en RedMine
    Cuando el Administrador TI consulta la bandeja de registros no reconocidos
    Entonces el sistema muestra el listado con la fuente de origen, identificador, descripción y fecha

  Escenario: Asociar manualmente un registro no reconocido a una petición existente
    Dado que existe un registro no reconocido pendiente de revisión
    Cuando el Administrador TI lo asocia al código de una petición válida o lo marca como revisado
    Entonces el registro se actualiza y deja de figurar como pendiente en la bandeja