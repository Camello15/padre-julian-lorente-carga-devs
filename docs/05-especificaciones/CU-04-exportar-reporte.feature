# language: es
# Responsable: Camilo. Requisitos: RF-13. Extiende CU-03.
Característica: CU-04 Exportar reporte
  Como PMO
  Quiero exportar lo que veo en el dashboard a Excel o PDF
  Para compartirlo en reuniones y con otras áreas

  Escenario: Exportar a Excel con los filtros aplicados
    Dado que inicié sesión con el rol "PMO"
    Y filtré el dashboard por el proyecto "Banca móvil"
    Cuando pulso "Exportar" y elijo "Excel"
    Entonces se descarga un archivo Excel
    Y el archivo contiene solo las peticiones del proyecto "Banca móvil"
    Y el archivo indica la fecha de la última sincronización

  Escenario: Un rol sin permiso no puede exportar
    Dado que inicié sesión con el rol "Técnico"
    Cuando abro el dashboard
    Entonces no veo el botón "Exportar"
