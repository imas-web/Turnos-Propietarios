import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import TopBar from './components/TopBar.jsx';
import Login from './pages/Login.jsx';
import Propietarios from './pages/Propietarios.jsx';
import Turnos from './pages/Turnos.jsx';
import ConfirmarTurnos from './pages/ConfirmarTurnos.jsx';
import Usuarios from './pages/Usuarios.jsx';

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

const INICIO_POR_ROL = {
  admin: '/usuarios',
  diagnotest: '/confirmar',
  extraccionista: '/turnos',
};

function Inicio() {
  const { rol } = useAuth();
  return <Navigate to={INICIO_POR_ROL[rol] || '/turnos'} replace />;
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
                    <RutaPorRol rol="extraccionista">
                      <Turnos />
                    </RutaPorRol>
                  }
                />
                <Route
                  path="/propietarios"
                  element={
                    <RutaPorRol rol="extraccionista">
                      <Propietarios />
                    </RutaPorRol>
                  }
                />
                <Route
                  path="/confirmar"
                  element={
                    <RutaPorRol rol="diagnotest">
                      <ConfirmarTurnos />
                    </RutaPorRol>
                  }
                />
                <Route
                  path="/usuarios"
                  element={
                    <RutaPorRol rol="admin">
                      <Usuarios />
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
