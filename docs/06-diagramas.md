# 6. Diagramas

## Diagrama de actividades

Muestra en paralelo la sincronización automática (Integración y Datos y alertas) y el uso del dashboard (Usuario web y API y seguridad).

```mermaid
flowchart TB
    I((" ")):::nodo
    F0[" "]:::barra
    subgraph INT["Integración"]
        A1["Disparar sincronización<br/>(cron cada 15 min)"]
        F1[" "]:::barra
        R1["RedMine<br/>peticiones"]
        R2["GitLab<br/>código"]
        R3["GLPI<br/>incidentes"]
        R4["Rocket Chat<br/>canales"]
        J1[" "]:::barra
        D1{"¿Alguna falló?"}
        M1{" "}
        A2["Normalizar y cruzar<br/>por código"]
        D2{"¿Código reconocido?"}
        A3["Identificar módulo<br/>del core financiero"]
    end
    subgraph DAT["Datos y alertas"]
        B1["Registrar fallo<br/>y usar últimos datos"]
        B2["Listar para revisión<br/>de TI"]
        B3["Guardar (upsert)<br/>sin duplicados"]
        B4["Calcular carga<br/>y avance"]
        D3{"¿Supera umbral?"}
        B5["Alertar: pantalla<br/>y Rocket Chat"]
    end
    subgraph API["API y seguridad"]
        C1["Validar sesión<br/>y cargar rol"]
        D4{"¿Sesión válida?"}
        C2["Consultar carga y avance<br/>(lee la BD)"]
        C3["Generar Excel o PDF"]
    end
    subgraph USR["Usuario web"]
        U1["Ingresar con SSO<br/>(login cooperativa)"]
        U2["Redirigir al login<br/>y reintentar"]
        U3["Elegir filtros<br/>dev, proyecto, tipo"]
        U4["Ver dashboard<br/>por dev y proyecto"]
        D5{"¿Exportar?"}
        U5["Descargar archivo"]
    end
    J0[" "]:::barra
    FN(((" "))):::nodo
    I --> F0
    F0 --> A1
    F0 --> U1
    A1 --> F1
    F1 --> R1 --> J1
    F1 --> R2 --> J1
    F1 --> R3 --> J1
    F1 --> R4 --> J1
    J1 --> D1
    D1 -- "[Sí]" --> B1 --> M1
    D1 -- "[No]" --> M1
    M1 --> A2 --> D2
    D2 -- "[No]" --> B2 --> B3
    D2 -- "[Sí]" --> A3 --> B3
    B3 --> B4 --> D3
    D3 -- "[Sí]" --> B5 --> J0
    D3 -- "[No]" --> J0
    U1 --> C1 --> D4
    D4 -- "[No]" --> U2 --> U1
    D4 -- "[Sí]" --> U3 --> C2 --> U4 --> D5
    D5 -- "[Sí]" --> C3 --> U5 --> J0
    D5 -- "[No]" --> J0
    J0 --> FN
    classDef nodo fill:#000,stroke:#000,color:#000
    classDef barra fill:#000,stroke:#000,color:#000
```

## Diagrama de clases (base)

Diagrama base. Cristina se encarga de unir el diagrama de clases final con los aportes de cada módulo.

| Módulo | Clases | Responsable |
|---|---|---|
| Usuario web y seguridad | Usuario, Rol, Sesion, Filtro, Reporte | Camilo |
| Integración | Fuente, Conector y sus hijas, Sincronizacion, RegistroFallo | Bryan |
| Datos y alertas | Desarrollador, Peticion, Proyecto, ModuloCore, ActividadCodigo, IndicadorCarga, Umbral, Alerta, RegistroNoReconocido | Cristina |

```mermaid
classDiagram
    direction LR
    class Usuario {
        -String id
        -String nombre
        -String correo
        -String idSso
        +obtenerRol() Rol
        +puedeVer(Desarrollador d) bool
    }
    class Rol {
        -String nombre
        -List~String~ permisos
        -bool soloPropios
        +tienePermiso(String permiso) bool
    }
    class Sesion {
        -String token
        -DateTime inicio
        -DateTime expira
        +esValida() bool
        +renovar()
        +cerrar()
    }
    class Filtro {
        -String desarrolladorId
        -String proyectoId
        -TipoTrabajo tipo
        -String moduloCore
        -Date desde
        -Date hasta
        +validar() bool
        +limpiar()
        +aplicarRestriccionRol(Rol r)
    }
    class Reporte {
        -String formato
        -DateTime generadoEn
        -DateTime fechaUltimaSync
        +generarExcel() File
        +generarPdf() File
    }
    class Fuente {
        +String nombre
        +String urlApi
        +bool activa
    }
    class Conector {
        <<abstract>>
        +leerDatos(DateTime desde) List
    }
    class ConectorRedmine
    class ConectorGitlab
    class ConectorGlpi
    class ConectorRocketChat
    class Sincronizacion {
        +DateTime inicio
        +DateTime fin
        +String estado
        +ejecutar()
    }
    class RegistroFallo {
        +DateTime fecha
        +int intentos
        +String mensaje
    }
    class Desarrollador {
        +String id
        +String nombre
        +String usuarioGitlab
    }
    class Peticion {
        +String codigo
        +String titulo
        +TipoTrabajo tipo
        +Etapa etapa
        +calcularAvance() int
    }
    class Proyecto {
        +String codigo
        +String nombre
    }
    class ModuloCore {
        +String nombre
    }
    class ActividadCodigo {
        +String tipo
        +String rama
        +DateTime fecha
    }
    class IndicadorCarga {
        +int peticionesAbiertas
        +int avancePromedio
        +DateTime calculadoEn
    }
    class Umbral {
        +int maxPeticiones
    }
    class Alerta {
        +String mensaje
        +DateTime fecha
        +enviar()
    }
    class RegistroNoReconocido {
        +String codigoOriginal
        +String fuente
        +bool revisado
    }
    class TipoTrabajo {
        <<enumeration>>
        POA
        REC
        INICIATIVA
        INCIDENTE
    }
    class Etapa {
        <<enumeration>>
        ANALISIS
        DESARROLLO
        CERTIFICACION
        DESPLIEGUE
        ESTABILIZACION
    }
    Usuario "1" --> "1" Rol : tiene
    Usuario "1" --> "0..*" Sesion : abre
    Usuario "1" --> "0..*" Reporte : exporta
    Reporte "1" --> "1" Filtro : usa
    Conector <|-- ConectorRedmine
    Conector <|-- ConectorGitlab
    Conector <|-- ConectorGlpi
    Conector <|-- ConectorRocketChat
    Fuente "1" --> "1" Conector : se lee con
    Sincronizacion "1" --> "1..*" Fuente : recorre
    Sincronizacion "1" --> "0..*" RegistroFallo : registra
    Proyecto "1" o-- "0..*" Peticion : agrupa
    Desarrollador "1" --> "0..*" Peticion : tiene asignadas
    Peticion "0..*" --> "0..*" ModuloCore : afecta
    Peticion "1" --> "0..*" ActividadCodigo : se relaciona con
    Desarrollador "1" --> "0..*" IndicadorCarga : se mide en
    IndicadorCarga ..> Umbral : se compara con
    IndicadorCarga "1" --> "0..*" Alerta : genera
    Sincronizacion "1" --> "0..*" RegistroNoReconocido : detecta
```

> En el prototipo, las clases de dominio se implementan como objetos y funciones de JavaScript (por ejemplo, `calcularAvance()` en `backend/src/datos/avance.js`). La correspondencia con las tablas está en `database/schema.sql`.
