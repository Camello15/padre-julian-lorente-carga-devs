# Cómo contribuir

## Ramas (Gitflow)

| Rama | Para qué sirve | Sale de | Se integra en |
|---|---|---|---|
| `main` | Versión estable. Protegida: solo entra por pull request. | — | — |
| `develop` | Integración del trabajo del equipo. Rama por defecto. | `main` | `main` (vía `release/*`) |
| `feature/*` | Una funcionalidad o entregable. | `develop` | `develop` |
| `release/*` | Preparar una entrega (por ejemplo, el cierre de un sprint). | `develop` | `main` y `develop` |
| `hotfix/*` | Corrección urgente sobre `main`. | `main` | `main` y `develop` |

### Nombres de ramas

Usa el caso de uso o el área y una descripción corta, en minúsculas y con guiones:

```
feature/CU-03-dashboard
feature/CU-05-conector-redmine
feature/CU-09-alertas-rocketchat
release/sprint-1
hotfix/filtro-fechas
```

## Commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/es/) **en español**:

| Prefijo | Cuándo |
|---|---|
| `feat:` | Nueva funcionalidad |
| `fix:` | Corrección de un error |
| `docs:` | Solo documentación |
| `test:` | Agregar o corregir pruebas |
| `refactor:` | Cambio de código sin cambiar comportamiento |
| `chore:` | Configuración, dependencias, tareas varias |
| `ci:` | Cambios del pipeline |

Ejemplos:

```
feat: agregar filtro por módulo del core en el dashboard
fix: corregir el cálculo de avance en la etapa de despliegue
docs: completar la ficha del CU-05
```

Haz commits pequeños: cada uno debe compilar y pasar las pruebas.

## Pull requests

1. Crea tu rama desde `develop` actualizado:
   ```bash
   git switch develop && git pull
   git switch -c feature/CU-03-dashboard
   ```
2. Antes de subir, corre `npm run lint` y `npm test`.
3. Abre el pull request **hacia `develop`** y enlaza el issue (`Cierra #12`).
4. **Otro integrante del equipo revisa y aprueba** el PR antes de integrarlo. Nadie integra su propio PR sin revisión.
5. El pipeline de CI (lint, pruebas, SonarQube y build de Docker) debe pasar.

## Reglas del proyecto

- Usa los nombres del [glosario](docs/07-glosario.md): Petición (no "tarea" ni "ticket"), Desarrollador, Etapa, Carga, Umbral…
- Clases en PascalCase sin tildes (`Peticion`), atributos y métodos en camelCase (`calcularAvance`).
- **Nunca** subas tokens, contraseñas ni el archivo `.env`. Las credenciales van en variables de entorno.
- No uses datos reales de la cooperativa: solo datos de prueba.
- Si cambias un comportamiento, actualiza `docs/`.
