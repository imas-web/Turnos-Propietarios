import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function TopBar() {
  const { nombre, rol, logout } = useAuth();
  const navigate = useNavigate();

  const salir = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="topbar">
      <h1>Turnos Propietarios</h1>
      <nav>
        {rol === 'extraccionista' && (
          <NavLink to="/turnos" className={({ isActive }) => (isActive ? 'active' : '')}>
            Turnos
          </NavLink>
        )}
        {rol === 'diagnotest' && (
          <NavLink to="/confirmar" className={({ isActive }) => (isActive ? 'active' : '')}>
            Confirmar turnos
          </NavLink>
        )}
        {rol === 'admin' && (
          <NavLink to="/usuarios" className={({ isActive }) => (isActive ? 'active' : '')}>
            Usuarios
          </NavLink>
        )}
        <span className="muted" style={{ padding: '0.4rem 0.4rem' }}>
          {nombre}
        </span>
        <button onClick={salir}>Salir</button>
      </nav>
    </header>
  );
}
