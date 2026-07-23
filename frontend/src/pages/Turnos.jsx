import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import CalendarioMes from '../components/CalendarioMes.jsx';

const FORM_VACIO = {
  paciente: '',
  tutor: '',
  telefono: '',
  direccion: '',
  email: '',
  fecha: '',
  hora_inicio: '',
};

const ETIQUETAS_ESTADO = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  rechazado: 'Rechazado',
  cancelado: 'Cancelado',
};

function formatearFecha(fechaStr) {
  const [anio, mes, dia] = fechaStr.split('-').map(Number);
  const fecha = new Date(anio, mes - 1, dia);
  const texto = fecha.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function rangoDelMes(anio, mes) {
  const ultimoDia = new Date(anio, mes + 1, 0).getDate();
  const m = String(mes + 1).padStart(2, '0');
  return {
    desde: `${anio}-${m}-01`,
    hasta: `${anio}-${m}-${String(ultimoDia).padStart(2, '0')}`,
  };
}

function agruparPorFecha(turnos) {
  const grupos = [];
  for (const turno of turnos) {
    let grupo = grupos.find((g) => g.fecha === turno.fecha);
    if (!grupo) {
      grupo = { fecha: turno.fecha, turnos: [] };
      grupos.push(grupo);
    }
    grupo.turnos.push(turno);
  }
  return grupos;
}

export default function Turnos() {
  const { token } = useAuth();
  const [turnos, setTurnos] = useState([]);
  const [form, setForm] = useState(FORM_VACIO);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroFecha, setFiltroFecha] = useState('');
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [resultadosBusqueda, setResultadosBusqueda] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const debounceBusqueda = useRef(null);
  const [calAnio, setCalAnio] = useState(() => new Date().getFullYear());
  const [calMes, setCalMes] = useState(() => new Date().getMonth());
  const [turnosMes, setTurnosMes] = useState([]);

  const cargarTurnosMes = async (anio = calAnio, mes = calMes) => {
    try {
      const data = await api.listarTurnos(token, rangoDelMes(anio, mes));
      setTurnosMes(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const cargarTurnos = async (estado = filtroEstado, fecha = filtroFecha) => {
    setCargando(true);
    try {
      const params = { estado };
      if (fecha) {
        params.desde = fecha;
        params.hasta = fecha;
      }
      const data = await api.listarTurnos(token, params);
      setTurnos(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarTurnos('', '');
    cargarTurnosMes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onFiltroEstadoChange = async (e) => {
    const estado = e.target.value;
    setFiltroEstado(estado);
    await cargarTurnos(estado, filtroFecha);
  };

  const onFiltroFechaChange = async (e) => {
    const fecha = e.target.value;
    setFiltroFecha(fecha);
    await cargarTurnos(filtroEstado, fecha);
  };

  const limpiarFiltroFecha = async () => {
    setFiltroFecha('');
    await cargarTurnos(filtroEstado, '');
  };

  const onCambiarMesCalendario = async (anio, mes) => {
    setCalAnio(anio);
    setCalMes(mes);
    await cargarTurnosMes(anio, mes);
  };

  const onSeleccionarDiaCalendario = async (fechaStr) => {
    setFiltroFecha(fechaStr);
    await cargarTurnos(filtroEstado, fechaStr);
  };

  const buscar = async (texto) => {
    if (!texto.trim()) {
      setResultadosBusqueda([]);
      return;
    }
    setBuscando(true);
    try {
      const data = await api.listarTurnos(token, { q: texto.trim() });
      setResultadosBusqueda(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBuscando(false);
    }
  };

  const onBusquedaChange = (e) => {
    const texto = e.target.value;
    setBusqueda(texto);
    if (debounceBusqueda.current) clearTimeout(debounceBusqueda.current);
    debounceBusqueda.current = setTimeout(() => buscar(texto), 300);
  };

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const abrirFormulario = () => {
    setEditando(null);
    setForm(FORM_VACIO);
    setMostrarForm(true);
    setMensaje('');
    setError('');
  };

  const abrirEdicion = (turno) => {
    setEditando(turno);
    setForm({
      paciente: turno.paciente,
      tutor: turno.tutor,
      telefono: turno.telefono,
      direccion: turno.direccion,
      email: turno.email,
      fecha: turno.fecha,
      hora_inicio: turno.hora_inicio,
    });
    setMostrarForm(true);
    setMensaje('');
    setError('');
  };

  const cerrarFormulario = () => {
    setMostrarForm(false);
    setEditando(null);
    setForm(FORM_VACIO);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMensaje('');
    try {
      if (editando) {
        await api.actualizarTurno(token, editando.id, form);
        setMensaje('Turno actualizado.');
      } else {
        await api.crearTurno(token, form);
        setMensaje('Turno creado. Queda pendiente de confirmacion.');
      }
      cerrarFormulario();
      await Promise.all([cargarTurnos(), cargarTurnosMes()]);
    } catch (err) {
      setError(err.message);
    }
  };

  const cancelar = async (id) => {
    if (!confirm('¿Cancelar este turno?')) return;
    setError('');
    try {
      await api.cancelarTurno(token, id);
      await Promise.all([cargarTurnos(), cargarTurnosMes()]);
    } catch (err) {
      setError(err.message);
    }
  };

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar este turno definitivamente?')) return;
    setError('');
    try {
      await api.eliminarTurno(token, id);
      await Promise.all([cargarTurnos(), cargarTurnosMes()]);
    } catch (err) {
      setError(err.message);
    }
  };

  const grupos = agruparPorFecha(turnos);
  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <div className="container container-angosto">
      {error && <div className="error-banner">{error}</div>}
      {mensaje && <div className="success-banner">{mensaje}</div>}

      {!mostrarForm && (
        <button className="btn btn-primary btn-ancho" onClick={abrirFormulario}>
          + Agregar turno nuevo
        </button>
      )}

      {mostrarForm && (
        <div className="card">
          <h2>{editando ? 'Editar turno' : 'Nuevo turno'}</h2>
          <form onSubmit={onSubmit}>
            <div className="field">
              <label>Paciente</label>
              <input name="paciente" value={form.paciente} onChange={onChange} required />
            </div>
            <div className="field" style={{ marginTop: '0.75rem' }}>
              <label>Tutor</label>
              <input name="tutor" value={form.tutor} onChange={onChange} required />
            </div>
            <div className="field" style={{ marginTop: '0.75rem' }}>
              <label>Telefono</label>
              <input name="telefono" type="tel" value={form.telefono} onChange={onChange} required />
            </div>
            <div className="field" style={{ marginTop: '0.75rem' }}>
              <label>Direccion</label>
              <input name="direccion" value={form.direccion} onChange={onChange} required />
            </div>
            <div className="field" style={{ marginTop: '0.75rem' }}>
              <label>Email</label>
              <input name="email" type="email" value={form.email} onChange={onChange} required />
            </div>
            <div className="field" style={{ marginTop: '0.75rem' }}>
              <label>Dia</label>
              <input
                type="date"
                name="fecha"
                min={hoy}
                value={form.fecha}
                onChange={onChange}
                required
              />
            </div>
            <div className="field" style={{ marginTop: '0.75rem' }}>
              <label>Horario</label>
              <input
                type="time"
                name="hora_inicio"
                min="08:00"
                max="19:59"
                value={form.hora_inicio}
                onChange={onChange}
                required
              />
            </div>
            <div className="actions-row" style={{ marginTop: '1rem' }}>
              <button className="btn btn-primary" type="submit">
                {editando ? 'Guardar cambios' : 'Crear turno'}
              </button>
              <button className="btn" type="button" onClick={cerrarFormulario}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <CalendarioMes
          anio={calAnio}
          mes={calMes}
          turnos={turnosMes}
          fechaSeleccionada={filtroFecha}
          onSeleccionarDia={onSeleccionarDiaCalendario}
          onCambiarMes={onCambiarMesCalendario}
        />
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Buscar turno</h2>
        <input
          type="search"
          placeholder="Buscar por paciente, tutor o email..."
          value={busqueda}
          onChange={onBusquedaChange}
          style={{ width: '100%' }}
        />

        {busqueda.trim() &&
          (buscando ? (
            <p className="muted" style={{ marginTop: '0.75rem' }}>
              Buscando...
            </p>
          ) : resultadosBusqueda.length === 0 ? (
            <p className="muted" style={{ marginTop: '0.75rem' }}>
              No se encontraron turnos.
            </p>
          ) : (
            <div style={{ marginTop: '0.75rem' }}>
              {resultadosBusqueda.map((t) => (
                <div key={t.id} className="agenda-item">
                  <div className="agenda-hora">
                    {formatearFecha(t.fecha)} · {t.hora_inicio}
                  </div>
                  <div className="agenda-datos">
                    <strong>{t.paciente}</strong>
                    <div className="muted">Tutor: {t.tutor}</div>
                    <div className="muted">{t.email}</div>
                  </div>
                  <span className={`badge badge-${t.estado}`}>{ETIQUETAS_ESTADO[t.estado]}</span>
                </div>
              ))}
            </div>
          ))}
      </div>

      <div className="card">
        <div className="agenda-header">
          <h2 style={{ margin: 0 }}>Turnos</h2>
          <div className="actions-row">
            <input type="date" value={filtroFecha} onChange={onFiltroFechaChange} />
            {filtroFecha && (
              <button className="btn" type="button" onClick={limpiarFiltroFecha}>
                Ver todos los dias
              </button>
            )}
            <select value={filtroEstado} onChange={onFiltroEstadoChange}>
              <option value="">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="confirmado">Confirmado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
        </div>

        {cargando ? (
          <p className="muted">Cargando...</p>
        ) : grupos.length === 0 ? (
          <p className="muted">No hay turnos para mostrar.</p>
        ) : (
          grupos.map((grupo) => (
            <div key={grupo.fecha} className="agenda-dia">
              <h3 className="agenda-fecha">{formatearFecha(grupo.fecha)}</h3>
              {grupo.turnos.map((t) => (
                <div key={t.id} className="agenda-item">
                  <div className="agenda-hora">
                    {t.hora_inicio} - {t.hora_fin}
                  </div>
                  <div className="agenda-datos">
                    <strong>{t.paciente}</strong>
                    <div className="muted">Tutor: {t.tutor}</div>
                    <div className="muted">{t.telefono}</div>
                    <div className="muted">{t.direccion}</div>
                    <div className="muted">{t.email}</div>
                    {t.estado === 'confirmado' && t.numero_dt && (
                      <div className="muted">Nº de protocolo: {t.numero_dt}</div>
                    )}
                  </div>
                  <span className={`badge badge-${t.estado}`}>{ETIQUETAS_ESTADO[t.estado]}</span>
                  <div className="actions-row">
                    {t.estado !== 'cancelado' && (
                      <button className="btn" onClick={() => abrirEdicion(t)}>
                        Editar
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
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
