import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import TopBar from './components/TopBar.jsx';
import Login from './pages/Login.jsx';
import Propietarios from './pages/Propietarios.jsx';
import Turnos from './pages/Turnos.jsx';
import ConfirmarTurno from './pages/ConfirmarTurno.jsx';

function RutaPrivada({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/confirmar/:token" element={<ConfirmarTurno />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <RutaPrivada>
            <div className="app-shell">
              <TopBar />
              <Routes>
                <Route path="/" element={<Navigate to="/turnos" replace />} />
                <Route path="/turnos" element={<Turnos />} />
                <Route path="/propietarios" element={<Propietarios />} />
                <Route path="*" element={<Navigate to="/turnos" replace />} />
              </Routes>
            </div>
          </RutaPrivada>
        }
      />
    </Routes>
  );
}
