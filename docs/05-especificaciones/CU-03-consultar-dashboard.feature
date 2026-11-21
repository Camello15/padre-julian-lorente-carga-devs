# language: es
# Responsable: Camilo. Requisitos: RF-07, RF-08, RF-09, RF-10, RNF-03. Incluye CU-01 y CU-02.
Característica: CU-03 Consultar dashboard de carga y avance
  Como PMO o usuario
  Quiero ver en un solo lugar la carga y el avance de cada desarrollador
  Para no cruzar datos a mano entre RedMine, GitLab, GLPI y Rocket Chat

  Escenario: Ver el resumen de carga del equipo
    Dado que inicié sesión con el rol "PMO"
    Y la última sincronización terminó correctamente
    Cuando abro el dashboard
    Entonces veo el total de peticiones abiertas
    Y veo cuántos desarrolladores están sobre el umbral
    Y veo la fecha de la última sincronización
    Y veo un gráfico de carga por desarrollador y tipo de trabajo

  Escenario: Ver el avance de una petición
    Dado que la petición "REC-2026-014" está en la etapa "Certificación"
    Cuando la busco en la tabla de peticiones
    Entonces veo su etapa "Certificación" con un avance de 70 %
