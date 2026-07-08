import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function TopBar() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  const salir = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="topbar">
      <h1>Turnos Propietarios</h1>
      <nav>
        <NavLink to="/turnos" className={({ isActive }) => (isActive ? 'active' : '')}>
          Turnos
        </NavLink>
        <NavLink to="/propietarios" className={({ isActive }) => (isActive ? 'active' : '')}>
          Propietarios
        </NavLink>
        <span className="muted" style={{ padding: '0.4rem 0.4rem' }}>
          {usuario}
        </span>
        <button onClick={salir}>Salir</button>
      </nav>
    </header>
  );
}
