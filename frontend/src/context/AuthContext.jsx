import { createContext, useContext, useMemo, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('turnos_token'));
  const [usuario, setUsuario] = useState(() => localStorage.getItem('turnos_usuario'));

  const login = (nuevoToken, nuevoUsuario) => {
    localStorage.setItem('turnos_token', nuevoToken);
    localStorage.setItem('turnos_usuario', nuevoUsuario);
    setToken(nuevoToken);
    setUsuario(nuevoUsuario);
  };

  const logout = () => {
    localStorage.removeItem('turnos_token');
    localStorage.removeItem('turnos_usuario');
    setToken(null);
    setUsuario(null);
  };

  const value = useMemo(
    () => ({ token, usuario, isAuthenticated: Boolean(token), login, logout }),
    [token, usuario]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
