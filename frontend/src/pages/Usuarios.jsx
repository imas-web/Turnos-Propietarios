import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

const FORM_VACIO = { usuario: '', password: '', rol: 'extraccionista', nombre: '' };

const ETIQUETAS_ROL = {
  extraccionista: 'Extraccionista',
  diagnotest: 'Diagnotest',
};

export default function Usuarios() {
  const { token } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [form, setForm] = useState(FORM_VACIO);
  const [editandoId, setEditandoId] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);

  const cargar = async () => {
    setCargando(true);
    try {
      const data = await api.listarUsuarios(token);
      setUsuarios(data);
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
        const { usuario, ...datosEditables } = form;
        if (!datosEditables.password) delete datosEditables.password;
        await api.actualizarUsuario(token, editandoId, datosEditables);
      } else {
        await api.crearUsuario(token, form);
      }
      setForm(FORM_VACIO);
      setEditandoId(null);
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  };

  const editar = (u) => {
    setEditandoId(u.id);
    setForm({ usuario: u.usuario, password: '', rol: u.rol, nombre: u.nombre });
  };

  const cancelarEdicion = () => {
    setEditandoId(null);
    setForm(FORM_VACIO);
  };

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar este usuario?')) return;
    setError('');
    try {
      await api.eliminarUsuario(token, id);
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="container">
      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <h2>{editandoId ? 'Editar usuario' : 'Nuevo usuario'}</h2>
        <form onSubmit={onSubmit}>
          <div className="form-grid">
            <div className="field">
              <label>Usuario</label>
              <input
                name="usuario"
                value={form.usuario}
                onChange={onChange}
                disabled={Boolean(editandoId)}
                required
              />
            </div>
            <div className="field">
              <label>Nombre</label>
              <input name="nombre" value={form.nombre} onChange={onChange} required />
            </div>
            <div className="field">
              <label>Rol</label>
              <select name="rol" value={form.rol} onChange={onChange} required>
                <option value="extraccionista">Extraccionista</option>
                <option value="diagnotest">Diagnotest</option>
              </select>
            </div>
            <div className="field">
              <label>{editandoId ? 'Nueva contraseña (opcional)' : 'Contraseña'}</label>
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={onChange}
                required={!editandoId}
              />
            </div>
          </div>
          <div className="actions-row" style={{ marginTop: '1rem' }}>
            <button className="btn btn-primary" type="submit">
              {editandoId ? 'Guardar cambios' : 'Crear usuario'}
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
        <h2>Usuarios</h2>
        {cargando ? (
          <p className="muted">Cargando...</p>
        ) : usuarios.length === 0 ? (
          <p className="muted">Todavia no hay usuarios cargados.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Usuario</th>
                <th>Rol</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td>{u.nombre}</td>
                  <td>{u.usuario}</td>
                  <td>{ETIQUETAS_ROL[u.rol]}</td>
                  <td>
                    <div className="actions-row">
                      <button className="btn" onClick={() => editar(u)}>
                        Editar
                      </button>
                      <button className="btn btn-danger" onClick={() => eliminar(u.id)}>
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
