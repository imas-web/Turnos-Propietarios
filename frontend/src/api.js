const API_URL = import.meta.env.VITE_API_URL || '/api';

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error || `Error ${res.status}`);
  }
  return data;
}

export const api = {
  login: (usuario, password) => request('/auth/login', { method: 'POST', body: { usuario, password } }),

  listarPropietarios: (token) => request('/propietarios', { token }),
  crearPropietario: (token, data) => request('/propietarios', { method: 'POST', body: data, token }),
  actualizarPropietario: (token, id, data) => request(`/propietarios/${id}`, { method: 'PUT', body: data, token }),
  eliminarPropietario: (token, id) => request(`/propietarios/${id}`, { method: 'DELETE', token }),

  listarTurnos: (token, params = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
    return request(`/turnos${query ? `?${query}` : ''}`, { token });
  },
  crearTurno: (token, data) => request('/turnos', { method: 'POST', body: data, token }),
  cancelarTurno: (token, id) => request(`/turnos/${id}/cancelar`, { method: 'POST', token }),
  eliminarTurno: (token, id) => request(`/turnos/${id}`, { method: 'DELETE', token }),
  confirmarTurno: (token, id) => request(`/turnos/${id}/confirmar`, { method: 'POST', token }),
  rechazarTurno: (token, id, motivo) =>
    request(`/turnos/${id}/rechazar`, { method: 'POST', body: { motivo }, token }),

  listarUsuarios: (token) => request('/usuarios', { token }),
  crearUsuario: (token, data) => request('/usuarios', { method: 'POST', body: data, token }),
  actualizarUsuario: (token, id, data) => request(`/usuarios/${id}`, { method: 'PUT', body: data, token }),
  eliminarUsuario: (token, id) => request(`/usuarios/${id}`, { method: 'DELETE', token }),
};
