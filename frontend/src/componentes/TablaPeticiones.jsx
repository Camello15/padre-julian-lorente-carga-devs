import { TIPO_POR_CLAVE } from '../utilidades/catalogo.js';
import { formatearFecha } from '../utilidades/formato.js';
import RielEtapas from './RielEtapas.jsx';

/** Peticiones con su Etapa y Avance (RF-07, RF-08). */
export default function TablaPeticiones({ peticiones, desarrolladores, proyectos, mostrarDesarrollador }) {
  if (peticiones.length === 0) {
    return <p className="vacio">No hay peticiones con estos filtros. Prueba quitando alguno.</p>;
  }
  const nombreDev = Object.fromEntries(desarrolladores.map((d) => [d.id, d.nombre]));
  const nombreProyecto = Object.fromEntries(proyectos.map((p) => [p.codigo, p.nombre]));
  const ordenadas = [...peticiones].sort(
    (a, b) => (a.estado === b.estado ? (a.fechaFin ?? '').localeCompare(b.fechaFin ?? '') : a.estado === 'abierta' ? -1 : 1),
  );

  return (
    <div className="tabla-contenedor" tabIndex={0} role="region" aria-label="Tabla de peticiones">
      <table className="tabla">
        <thead>
          <tr>
            <th scope="col">Petición</th>
            <th scope="col">Tipo</th>
            {mostrarDesarrollador && <th scope="col">Desarrollador</th>}
            <th scope="col">Etapa y avance</th>
            <th scope="col">Entrega planificada</th>
          </tr>
        </thead>
        <tbody>
          {ordenadas.map((p) => {
            const tipo = TIPO_POR_CLAVE[p.tipo];
            return (
              <tr key={p.codigo} className={p.estado === 'cerrada' ? 'tabla__fila--cerrada' : undefined}>
                <td>
                  <span className="tabla__codigo">{p.codigo}</span>
                  <span className="tabla__titulo">{p.titulo}</span>
                  <span className="tabla__meta">
                    {nombreProyecto[p.proyectoId] ?? p.proyectoId}
                    {p.modulosCore.length > 0 && `, módulo ${p.modulosCore.join(' y ')}`}
                  </span>
                </td>
                <td>
                  <span className="tipo" style={{ '--color-tipo': tipo.color }}>
                    <i className="punto" aria-hidden="true" />{tipo.nombre}
                  </span>
                  {p.estado === 'cerrada' && <span className="estado-cerrada">Cerrada</span>}
                </td>
                {mostrarDesarrollador && <td>{nombreDev[p.desarrolladorId] ?? 'Sin asignar'}</td>}
                <td><RielEtapas etapa={p.etapa} avance={p.avance} /></td>
                <td className="tabla__fecha">{formatearFecha(p.fechaFin)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
