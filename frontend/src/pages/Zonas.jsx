import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

function agruparPorZona(zonas) {
  const grupos = [];
  for (const z of zonas) {
    let grupo = grupos.find((g) => g.nombre.toLowerCase() === z.nombre.toLowerCase());
    if (!grupo) {
      grupo = { nombre: z.nombre, extraccionistas: [] };
      grupos.push(grupo);
    }
    grupo.extraccionistas.push({ id: z.extraccionista_id, nombre: z.extraccionista_nombre });
  }
  return grupos.sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export default function Zonas() {
  const { token } = useAuth();
  const [extraccionistas, setExtraccionistas] = useState([]);
  const [zonas, setZonas] = useState([]);
  const [nombre, setNombre] = useState('');
  const [seleccionadas, setSeleccionadas] = useState([]);
  const [editandoNombre, setEditandoNombre] = useState(null);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(true);
  const [textoMasivo, setTextoMasivo] = useState('');
  const [seleccionadasMasivo, setSeleccionadasMasivo] = useState([]);

  const cargar = async () => {
    setCargando(true);
    try {
      const [usuarios, listaZonas] = await Promise.all([
        api.listarUsuarios(token),
        api.listarZonas(token),
      ]);
      setExtraccionistas(usuarios.filter((u) => u.rol === 'extraccionista'));
      setZonas(listaZonas);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const alternarSeleccion = (id) => {
    setSeleccionadas((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const limpiarFormulario = () => {
    setNombre('');
    setSeleccionadas([]);
    setEditandoNombre(null);
  };

  const editarZona = (grupo) => {
    setEditandoNombre(grupo.nombre);
    setNombre(grupo.nombre);
    setSeleccionadas(grupo.extraccionistas.map((e) => e.id));
    setMensaje('');
    setError('');
  };

  const eliminarZona = async (nombreZona) => {
    if (!confirm(`¿Eliminar la zona "${nombreZona}"?`)) return;
    setError('');
    try {
      await api.asignarZona(token, nombreZona, []);
      setMensaje('Zona eliminada.');
      if (editandoNombre === nombreZona) limpiarFormulario();
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMensaje('');
    try {
      await api.asignarZona(token, nombre, seleccionadas);
      setMensaje('Zona guardada.');
      limpiarFormulario();
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  };

  const alternarSeleccionMasivo = (id) => {
    setSeleccionadasMasivo((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const onSubmitMasivo = async (e) => {
    e.preventDefault();
    setError('');
    setMensaje('');
    const nombres = textoMasivo
      .split('\n')
      .map((linea) => linea.trim())
      .filter(Boolean);
    if (nombres.length === 0 || seleccionadasMasivo.length === 0) {
      setError('Pega al menos una zona (una por linea) y elegi a quien asignarla.');
      return;
    }
    try {
      const res = await api.agregarZonasMasivo(token, nombres, seleccionadasMasivo);
      setMensaje(`Se agregaron ${res.insertados} asignacion(es) de ${res.zonas} zona(s).`);
      setTextoMasivo('');
      setSeleccionadasMasivo([]);
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  };

  const grupos = agruparPorZona(zonas);

  return (
    <div className="container">
      {error && <div className="error-banner">{error}</div>}
      {mensaje && <div className="success-banner">{mensaje}</div>}

      <div className="card">
        <h2>{editandoNombre ? `Editar zona "${editandoNombre}"` : 'Nueva zona'}</h2>
        <form onSubmit={onSubmit}>
          <div className="field">
            <label>Nombre de la zona (barrio, localidad, CP, etc.)</label>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          </div>
          <div className="field" style={{ marginTop: '0.85rem' }}>
            <label>Extraccionista(s) que cubren esta zona</label>
            {extraccionistas.length === 0 ? (
              <p className="muted">No hay extraccionistas cargadas.</p>
            ) : (
              <div className="actions-row">
                {extraccionistas.map((ex) => (
                  <label key={ex.id} className="zona-checkbox">
                    <input
                      type="checkbox"
                      checked={seleccionadas.includes(ex.id)}
                      onChange={() => alternarSeleccion(ex.id)}
                    />
                    {ex.nombre}
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="actions-row" style={{ marginTop: '1rem' }}>
            <button className="btn btn-primary" type="submit">
              {editandoNombre ? 'Guardar cambios' : 'Crear zona'}
            </button>
            {editandoNombre && (
              <button className="btn" type="button" onClick={limpiarFormulario}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="card">
        <h2>Carga masiva</h2>
        <p className="muted">
          Pegá una lista de zonas (una por línea) y elegí a qué extraccionista(s) asignarlas.
          Suma a lo que ya haya cargado, no borra nada existente.
        </p>
        <form onSubmit={onSubmitMasivo}>
          <div className="field">
            <label>Zonas (una por línea)</label>
            <textarea
              rows={8}
              value={textoMasivo}
              onChange={(e) => setTextoMasivo(e.target.value)}
              placeholder={'Palermo\nVilla Crespo\nCaballito'}
              style={{ width: '100%' }}
            />
          </div>
          <div className="field" style={{ marginTop: '0.85rem' }}>
            <label>Asignar a</label>
            {extraccionistas.length === 0 ? (
              <p className="muted">No hay extraccionistas cargadas.</p>
            ) : (
              <div className="actions-row">
                {extraccionistas.map((ex) => (
                  <label key={ex.id} className="zona-checkbox">
                    <input
                      type="checkbox"
                      checked={seleccionadasMasivo.includes(ex.id)}
                      onChange={() => alternarSeleccionMasivo(ex.id)}
                    />
                    {ex.nombre}
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="actions-row" style={{ marginTop: '1rem' }}>
            <button className="btn btn-primary" type="submit">
              Agregar zonas
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2>Zonas cargadas</h2>
        {cargando ? (
          <p className="muted">Cargando...</p>
        ) : grupos.length === 0 ? (
          <p className="muted">Todavia no hay zonas cargadas.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Zona</th>
                <th>Extraccionista(s)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {grupos.map((g) => (
                <tr key={g.nombre}>
                  <td>{g.nombre}</td>
                  <td>{g.extraccionistas.map((e) => e.nombre).join(', ')}</td>
                  <td>
                    <div className="actions-row">
                      <button className="btn" onClick={() => editarZona(g)}>
                        Editar
                      </button>
                      <button className="btn btn-danger" onClick={() => eliminarZona(g.nombre)}>
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
