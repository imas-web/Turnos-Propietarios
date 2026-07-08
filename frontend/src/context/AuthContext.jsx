import { createContext, useContext, useMemo, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('turnos_token'));
  const [usuario, setUsuario] = useState(() => localStorage.getItem('turnos_usuario'));
  const [rol, setRol] = useState(() => localStorage.getItem('turnos_rol'));
  const [nombre, setNombre] = useState(() => localStorage.getItem('turnos_nombre'));

  const login = (nuevoToken, datos) => {
    localStorage.setItem('turnos_token', nuevoToken);
    localStorage.setItem('turnos_usuario', datos.usuario);
    localStorage.setItem('turnos_rol', datos.rol);
    localStorage.setItem('turnos_nombre', datos.nombre);
    setToken(nuevoToken);
    setUsuario(datos.usuario);
    setRol(datos.rol);
    setNombre(datos.nombre);
  };

  const logout = () => {
    localStorage.removeItem('turnos_token');
    localStorage.removeItem('turnos_usuario');
    localStorage.removeItem('turnos_rol');
    localStorage.removeItem('turnos_nombre');
    setToken(null);
    setUsuario(null);
    setRol(null);
    setNombre(null);
  };

  const value = useMemo(
    () => ({ token, usuario, rol, nombre, isAuthenticated: Boolean(token), login, logout }),
    [token, usuario, rol, nombre]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
