import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

const FORM_VACIO = {
  propietario_id: '',
  titulo: '',
  descripcion: '',
  fecha: '',
  hora_inicio: '',
  hora_fin: '',
};

const ETIQUETAS_ESTADO = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  rechazado: 'Rechazado',
  cancelado: 'Cancelado',
};

export default function Turnos() {
  const { token } = useAuth();
  const [turnos, setTurnos] = useState([]);
  const [propietarios, setPropietarios] = useState([]);
  const [form, setForm] = useState(FORM_VACIO);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(true);

  const cargarPropietarios = async () => {
    const data = await api.listarPropietarios(token);
    setPropietarios(data);
  };

  const cargarTurnos = async (estado = filtroEstado) => {
    setCargando(true);
    try {
      const data = await api.listarTurnos(token, { estado });
      setTurnos(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarPropietarios().catch((err) => setError(err.message));
    cargarTurnos('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onFiltroChange = async (e) => {
    const estado = e.target.value;
    setFiltroEstado(estado);
    await cargarTurnos(estado);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMensaje('');
    try {
      await api.crearTurno(token, form);
      setForm(FORM_VACIO);
      setMensaje('Turno creado. Se genero el link de confirmacion para el propietario.');
      await cargarTurnos();
    } catch (err) {
      setError(err.message);
    }
  };

  const copiarLink = async (link) => {
    try {
      await navigator.clipboard.writeText(link);
      setMensaje('Link de confirmacion copiado al portapapeles.');
    } catch {
      setMensaje(link);
    }
  };

  const cancelar = async (id) => {
    if (!confirm('¿Cancelar este turno?')) return;
    setError('');
    try {
      await api.cancelarTurno(token, id);
      await cargarTurnos();
    } catch (err) {
      setError(err.message);
    }
  };

  const reenviar = async (id) => {
    setError('');
    setMensaje('');
    try {
      await api.reenviarTurno(token, id);
      setMensaje('Se genero un nuevo link de confirmacion.');
      await cargarTurnos();
    } catch (err) {
      setError(err.message);
    }
  };

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar este turno definitivamente?')) return;
    setError('');
    try {
      await api.eliminarTurno(token, id);
      await cargarTurnos();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="container">
      {error && <div className="error-banner">{error}</div>}
      {mensaje && <div className="success-banner">{mensaje}</div>}

      <div className="card">
        <h2>Nuevo turno</h2>
        <form onSubmit={onSubmit}>
          <div className="form-grid">
            <div className="field">
              <label>Propietario</label>
              <select name="propietario_id" value={form.propietario_id} onChange={onChange} required>
                <option value="">Seleccionar...</option>
                {propietarios.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} ({p.unidad})
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Titulo</label>
              <input name="titulo" value={form.titulo} onChange={onChange} required />
            </div>
            <div className="field">
              <label>Fecha</label>
              <input type="date" name="fecha" value={form.fecha} onChange={onChange} required />
            </div>
            <div className="field">
              <label>Hora inicio</label>
              <input type="time" name="hora_inicio" value={form.hora_inicio} onChange={onChange} required />
            </div>
            <div className="field">
              <label>Hora fin</label>
              <input type="time" name="hora_fin" value={form.hora_fin} onChange={onChange} required />
            </div>
          </div>
          <div className="field" style={{ marginTop: '0.85rem' }}>
            <label>Descripcion (opcional)</label>
            <textarea name="descripcion" value={form.descripcion} onChange={onChange} rows={2} />
          </div>
          <div className="actions-row" style={{ marginTop: '1rem' }}>
            <button className="btn btn-primary" type="submit">
              Crear turno y generar confirmacion
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Turnos</h2>
          <div className="field" style={{ minWidth: 180 }}>
            <select value={filtroEstado} onChange={onFiltroChange}>
              <option value="">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="confirmado">Confirmado</option>
              <option value="rechazado">Rechazado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
        </div>

        {cargando ? (
          <p className="muted">Cargando...</p>
        ) : turnos.length === 0 ? (
          <p className="muted">No hay turnos para mostrar.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Turno</th>
                <th>Propietario</th>
                <th>Fecha / Horario</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {turnos.map((t) => (
                <tr key={t.id}>
                  <td>
                    <strong>{t.titulo}</strong>
                    {t.descripcion && <div className="muted">{t.descripcion}</div>}
                    {t.estado === 'rechazado' && t.motivo_rechazo && (
                      <div className="muted">Motivo: {t.motivo_rechazo}</div>
                    )}
                  </td>
                  <td>
                    {t.propietario_nombre}
                    <div className="muted">{t.propietario_unidad}</div>
                  </td>
                  <td>
                    {t.fecha}
                    <div className="muted">{t.hora_inicio} - {t.hora_fin}</div>
                  </td>
                  <td>
                    <span className={`badge badge-${t.estado}`}>{ETIQUETAS_ESTADO[t.estado]}</span>
                  </td>
                  <td>
                    <div className="actions-row">
                      {t.estado === 'pendiente' && t.link_confirmacion && (
                        <button className="btn btn-success" onClick={() => copiarLink(t.link_confirmacion)}>
                          Copiar link
                        </button>
                      )}
                      {(t.estado === 'rechazado' || t.estado === 'pendiente') && (
                        <button className="btn" onClick={() => reenviar(t.id)}>
                          Reenviar
                        </button>
                      )}
                      {t.estado !== 'cancelado' && (
                        <button className="btn" onClick={() => cancelar(t.id)}>
                          Cancelar
                        </button>
                      )}
                      <button className="btn btn-danger" onClick={() => eliminar(t.id)}>
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
