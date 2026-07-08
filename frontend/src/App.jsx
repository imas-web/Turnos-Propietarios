import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import TopBar from './components/TopBar.jsx';
import Login from './pages/Login.jsx';
import Propietarios from './pages/Propietarios.jsx';
import Turnos from './pages/Turnos.jsx';
import ConfirmarTurnos from './pages/ConfirmarTurnos.jsx';

function RutaPrivada({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function RutaPorRol({ rol, children }) {
  const { rol: rolActual } = useAuth();
  if (rolActual !== rol) return <Navigate to="/" replace />;
  return children;
}

function Inicio() {
  const { rol } = useAuth();
  if (rol === 'confirmador') return <Navigate to="/confirmar" replace />;
  return <Navigate to="/turnos" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <RutaPrivada>
            <div className="app-shell">
              <TopBar />
              <Routes>
                <Route path="/" element={<Inicio />} />
                <Route
                  path="/turnos"
                  element={
                    <RutaPorRol rol="cargador">
                      <Turnos />
                    </RutaPorRol>
                  }
                />
                <Route
                  path="/propietarios"
                  element={
                    <RutaPorRol rol="cargador">
                      <Propietarios />
                    </RutaPorRol>
                  }
                />
                <Route
                  path="/confirmar"
                  element={
                    <RutaPorRol rol="confirmador">
                      <ConfirmarTurnos />
                    </RutaPorRol>
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          </RutaPrivada>
        }
      />
    </Routes>
  );
}
