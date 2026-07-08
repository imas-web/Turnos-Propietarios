import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

const FORM_VACIO = { nombre: '', email: '', telefono: '', unidad: '' };

export default function Propietarios() {
  const { token } = useAuth();
  const [propietarios, setPropietarios] = useState([]);
  const [form, setForm] = useState(FORM_VACIO);
  const [editandoId, setEditandoId] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);

  const cargar = async () => {
    setCargando(true);
    try {
      const data = await api.listarPropietarios(token);
      setPropietarios(data);
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

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editandoId) {
        await api.actualizarPropietario(token, editandoId, form);
      } else {
        await api.crearPropietario(token, form);
      }
      setForm(FORM_VACIO);
      setEditandoId(null);
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  };

  const editar = (p) => {
    setEditandoId(p.id);
    setForm({ nombre: p.nombre, email: p.email, telefono: p.telefono || '', unidad: p.unidad });
  };

  const cancelarEdicion = () => {
    setEditandoId(null);
    setForm(FORM_VACIO);
  };

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar este propietario y sus turnos asociados?')) return;
    setError('');
    try {
      await api.eliminarPropietario(token, id);
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="container">
      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <h2>{editandoId ? 'Editar propietario' : 'Nuevo propietario'}</h2>
        <form onSubmit={onSubmit}>
          <div className="form-grid">
            <div className="field">
              <label>Nombre</label>
              <input name="nombre" value={form.nombre} onChange={onChange} required />
            </div>
            <div className="field">
              <label>Email</label>
              <input name="email" type="email" value={form.email} onChange={onChange} required />
            </div>
            <div className="field">
              <label>Telefono</label>
              <input name="telefono" value={form.telefono} onChange={onChange} />
            </div>
            <div className="field">
              <label>Unidad</label>
              <input name="unidad" value={form.unidad} onChange={onChange} required />
            </div>
          </div>
          <div className="actions-row" style={{ marginTop: '1rem' }}>
            <button className="btn btn-primary" type="submit">
              {editandoId ? 'Guardar cambios' : 'Crear propietario'}
            </button>
            {editandoId && (
              <button className="btn" type="button" onClick={cancelarEdicion}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="card">
        <h2>Propietarios</h2>
        {cargando ? (
          <p className="muted">Cargando...</p>
        ) : propietarios.length === 0 ? (
          <p className="muted">Todavia no hay propietarios cargados.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Unidad</th>
                <th>Email</th>
                <th>Telefono</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {propietarios.map((p) => (
                <tr key={p.id}>
                  <td>{p.nombre}</td>
                  <td>{p.unidad}</td>
                  <td>{p.email}</td>
                  <td>{p.telefono || '-'}</td>
                  <td>
                    <div className="actions-row">
                      <button className="btn" onClick={() => editar(p)}>
                        Editar
                      </button>
                      <button className="btn btn-danger" onClick={() => eliminar(p.id)}>
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
