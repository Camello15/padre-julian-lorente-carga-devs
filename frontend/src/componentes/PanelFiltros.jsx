import { TIPOS } from '../utilidades/catalogo.js';
import { FILTROS_VACIOS } from '../utilidades/formato.js';

/** CU-02 Filtrar información: desarrollador, tipo, proyecto, módulo y fechas (RF-11). */
export default function PanelFiltros({ filtros, onCambiar, catalogos, usuario }) {
  const soloPropios = usuario.rol.soloPropios;
  const cambiar = (campo) => (evento) => onCambiar({ ...filtros, [campo]: evento.target.value });
  const hayFiltros = Object.entries(filtros).some(([campo, valor]) => valor && !(soloPropios && campo === 'desarrollador'));

  return (
    <form className="filtros" aria-labelledby="titulo-filtros" onSubmit={(e) => e.preventDefault()}>
      <div className="filtros__cabecera">
        <h2 id="titulo-filtros">Filtros</h2>
        {hayFiltros && (
          <button type="button" className="boton-enlace" onClick={() => onCambiar({ ...FILTROS_VACIOS, desarrollador: soloPropios ? filtros.desarrollador : '' })}>
            Limpiar
          </button>
        )}
      </div>

      <label className="campo">
        <span className="campo__etiqueta">Desarrollador</span>
        <select value={filtros.desarrollador} onChange={cambiar('desarrollador')} disabled={soloPropios}>
          {!soloPropios && <option value="">Todos</option>}
          {catalogos.desarrolladores.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
        </select>
        {soloPropios && <span className="campo__ayuda">Con el rol Técnico ves solo tu propia carga.</span>}
      </label>

      <fieldset className="campo">
        <legend className="campo__etiqueta">Tipo de trabajo</legend>
        <div className="chips">
          {[{ clave: '', nombre: 'Todos' }, ...TIPOS].map((tipo) => (
            <label key={tipo.clave || 'todos'} className="chip" style={tipo.color ? { '--color-tipo': tipo.color } : undefined}>
              <input type="radio" name="tipo" value={tipo.clave} checked={filtros.tipo === tipo.clave} onChange={cambiar('tipo')} />
              <span>{tipo.color && <i className="punto" aria-hidden="true" />}{tipo.nombre}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="campo">
        <span className="campo__etiqueta">Proyecto</span>
        <select value={filtros.proyecto} onChange={cambiar('proyecto')}>
          <option value="">Todos</option>
          {catalogos.proyectos.map((p) => <option key={p.codigo} value={p.codigo}>{p.nombre}</option>)}
        </select>
      </label>

      <label className="campo">
        <span className="campo__etiqueta">Módulo del core</span>
        <select value={filtros.modulo} onChange={cambiar('modulo')}>
          <option value="">Todos</option>
          {catalogos.modulosCore.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </label>

      <fieldset className="campo">
        <legend className="campo__etiqueta">Fechas planificadas</legend>
        <div className="fechas">
          <label>
            <span className="campo__ayuda">Desde</span>
            <input type="date" value={filtros.desde} max={filtros.hasta || undefined} onChange={cambiar('desde')} />
          </label>
          <label>
            <span className="campo__ayuda">Hasta</span>
            <input type="date" value={filtros.hasta} min={filtros.desde || undefined} onChange={cambiar('hasta')} />
          </label>
        </div>
      </fieldset>
    </form>
  );
}
