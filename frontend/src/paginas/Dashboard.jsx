import { useEffect, useState } from 'react';
import { ErrorSesion, pedir } from '../api.js';
import GraficoCarga from '../componentes/GraficoCarga.jsx';
import PanelAdministracionTI from '../componentes/PanelAdministracionTI.jsx';
import PanelAlertas from '../componentes/PanelAlertas.jsx';
import PanelFiltros from '../componentes/PanelFiltros.jsx';
import ResumenCarga from '../componentes/ResumenCarga.jsx';
import TablaPeticiones from '../componentes/TablaPeticiones.jsx';
import { construirConsulta, FILTROS_VACIOS, plural } from '../utilidades/formato.js';

// CU-03 Consultar dashboard de carga y avance.
export default function Dashboard({ sesion, onSalir }) {
const { usuario, token } = sesion;
const soloPropios = usuario.rol.soloPropios;
const puedeExportar = usuario.rol.permisos.includes('exportar');
const puedeConfigurar = usuario.rol.permisos.includes('configurar');

const [filtros, setFiltros] = useState({ ...FILTROS_VACIOS, desarrollador: soloPropios ? usuario.desarrolladorId : '' });
const [catalogos, setCatalogos] = useState(null);
const [alertas, setAlertas] = useState([]);
const [carga, setCarga] = useState(null);
const [peticiones, setPeticiones] = useState([]);
const [cargando, setCargando] = useState(true);
const [error, setError] = useState('');
const [avisoExportar, setAvisoExportar] = useState(false);

// Catálogos y alertas: una vez por sesión.
useEffect(() => {
const control = new AbortController();
Promise.all([
pedir('/catalogos', { token, signal: control.signal }),
pedir('/alertas', { token, signal: control.signal }),
])
.then(([cat, al]) => { setCatalogos(cat); setAlertas(al.alertas); })
.catch((e) => {
if (e.name === 'AbortError') return;
if (e instanceof ErrorSesion) onSalir(e.message);
else setError(e.message);
});
return () => control.abort();
}, [token, onSalir]);

// Carga y peticiones: cada vez que cambian los filtros.
useEffect(() => {
const control = new AbortController();
const consulta = construirConsulta(filtros);
Promise.all([
pedir(`/carga${consulta}`, { token, signal: control.signal }),
pedir(`/peticiones${consulta}`, { token, signal: control.signal }),
])
.then(([c, p]) => { setCarga(c); setPeticiones(p.peticiones); setError(''); setCargando(false); })
.catch((e) => {
if (e.name === 'AbortError') return;
if (e instanceof ErrorSesion) onSalir(e.message);
else { setError(e.message); setCargando(false); }
});
return () => control.abort();
}, [filtros, token, onSalir]);

const cambiarFiltros = (nuevos) => {
setCargando(true);
setFiltros(nuevos);
};

const listo = catalogos && carga;

return (



  <main className="dashboard" aria-busy={cargando}>
    <div className="dashboard__titulo">
      <div>
        <h1>{soloPropios ? 'Tu carga de trabajo' : 'Carga y avance del equipo'}</h1>
        <p className="texto-suave">
          Peticiones de RedMine, GitLab, GLPI y Rocket Chat unificadas por desarrollador.
        </p>
      </div>
      {puedeExportar && (
        <div className="exportar">
          {/* TODO (Camilo, CU-04): GET /api/reportes?formato=xlsx|pdf con los filtros actuales. */}
          <button type="button" className="boton boton--secundario" onClick={() => setAvisoExportar(true)} aria-describedby="aviso-exportar">
            Exportar
          </button>
          {avisoExportar && (
            <p id="aviso-exportar" className="exportar__aviso" role="status">
              La exportación a Excel y PDF llega en el Sprint 4.
            </p>
          )}
        </div>
      )}
    </div>

    {error && <p className="mensaje mensaje--error" role="alert">{error}</p>}

    {!listo && !error && <p className="cargando">Cargando datos…</p>}

    {listo && (
      <div className="dashboard__cuerpo">
        <aside className="dashboard__filtros">
          <PanelFiltros filtros={filtros} onCambiar={cambiarFiltros} catalogos={catalogos} usuario={usuario} />
        </aside>

        <div className="dashboard__contenido">
          <ResumenCarga resumen={carga.resumen} umbral={carga.umbral} />

          <div className="dashboard__fila">
            <section className="panel panel--grafico" aria-labelledby="titulo-grafico">
              <div className="panel__cabecera">
                <h2 id="titulo-grafico">Carga por desarrollador</h2>
                <p className="texto-suave">Peticiones abiertas según el tipo de trabajo.</p>
              </div>
              <GraficoCarga indicadores={carga.indicadores} umbral={carga.umbral} />
            </section>

            <section className="panel panel--alertas" aria-labelledby="titulo-alertas">
              <div className="panel__cabecera">
                <h2 id="titulo-alertas">Alertas</h2>
                <p className="texto-suave">Se generan en cada sincronización.</p>
              </div>
              <PanelAlertas alertas={alertas} umbral={carga.umbral} />
            </section>
          </div>

          <section className="panel" aria-labelledby="titulo-peticiones">
            <div className="panel__cabecera">
              <h2 id="titulo-peticiones">Peticiones</h2>
              <p className="texto-suave">
                {plural(peticiones.length, 'petición', 'peticiones')}. El avance se estima según la etapa de RedMine.
              </p>
            </div>
            <TablaPeticiones
              peticiones={peticiones}
              desarrolladores={catalogos.desarrolladores}
              proyectos={catalogos.proyectos}
              mostrarDesarrollador={!soloPropios}
            />
          </section>

          {puedeConfigurar && (
            <PanelAdministracionTI
              token={token}
              umbralActual={carga.umbral}
              onUmbralActualizado={(nuevoUmbral, nuevasAlertas, nuevosIndicadores) => {
                setCatalogos((prev) => (prev ? { ...prev, umbral: nuevoUmbral } : prev));
                setCarga((prev) =>
                  prev
                    ? {
                        ...prev,
                        umbral: nuevoUmbral,
                        indicadores: nuevosIndicadores ?? prev.indicadores,
                        resumen: nuevosIndicadores
                          ? {
                              ...prev.resumen,
                              desarrolladoresSobreUmbral: nuevosIndicadores.filter((i) => i.superaUmbral).length,
                            }
                          : prev.resumen,
                      }
                    : prev,
                );
                if (nuevasAlertas) setAlertas(nuevasAlertas);
              }}
            />
          )}
        </div>
      </div>
    )}
  </main>
);
}