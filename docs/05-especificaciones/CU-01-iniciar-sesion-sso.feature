# language: es
# Responsable: Camilo. Requisitos: RF-01, RNF-02.
Característica: CU-01 Iniciar sesión con SSO
  Como usuario de la cooperativa (PMO, Técnico o Administrativo)
  Quiero ingresar con mi cuenta del SSO de la cooperativa
  Para consultar la carga de trabajo sin crear otra contraseña

  Escenario: Ingreso exitoso con el SSO
    Dado que estoy en la pantalla de inicio de sesión
    Y tengo una cuenta válida en el SSO de la cooperativa con el rol "PMO"
    Cuando pulso "Ingresar con SSO de la cooperativa"
    Y el SSO confirma mi identidad
    Entonces veo el dashboard de carga y avance
    Y en el encabezado aparece mi nombre con el rol "PMO"

  Escenario: Sesión no válida
    Dado que mi sesión expiró
    Cuando intento consultar el dashboard
    Entonces vuelvo a la pantalla de inicio de sesión
    Y veo el mensaje "Tu sesión expiró. Vuelve a ingresar."
