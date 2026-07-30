import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

const DIACRITICOS = /[\u0300-\u036f]/g;

function normalizar(texto) {
  return texto.normalize('NFD').replace(DIACRITICOS, '').toLowerCase().trim();
}

function agruparPorZona(zonas) {
  const grupos = [];
  for (const z of zonas) {
    let grupo = grupos.find((g) => g.nombre.toLowerCase() === z.nombre.toLowerCase());
    if (!grupo) {
      grupo = { nombre: z.nombre, extraccionistas: [] };
      grupos.push(grupo);
    }
    grupo.extraccionistas.push(z.extraccionista_nombre);
  }
  return grupos.sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export default function DerivarZona() {
  const { token } = useAuth();
  const [zonas, setZonas] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api
      .listarZonas(token)
      .then(setZonas)
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, [token]);

  const grupos = agruparPorZona(zonas);
  const busquedaNormalizada = normalizar(busqueda);
  const resultados = busquedaNormalizada
    ? grupos.filter((g) => normalizar(g.nombre).includes(busquedaNormalizada))
    : grupos;

  return (
    <div className="container container-angosto">
      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Derivar por zona</h2>
        <p className="muted">
          Escribí el barrio, localidad o código postal del paciente para saber qué extraccionista
          le corresponde.
        </p>
        <input
          type="search"
          placeholder="Ej: Palermo, Villa Crespo, 1414..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={{ width: '100%' }}
          autoFocus
        />

        {cargando ? (
          <p className="muted" style={{ marginTop: '0.85rem' }}>
            Cargando...
          </p>
        ) : grupos.length === 0 ? (
          <p className="muted" style={{ marginTop: '0.85rem' }}>
            Todavía no hay zonas cargadas. Pedile al admin que las configure en "Zonas".
          </p>
        ) : resultados.length === 0 ? (
          <p className="muted" style={{ marginTop: '0.85rem' }}>
            No se encontró esa zona.
          </p>
        ) : (
          <div style={{ marginTop: '0.85rem' }}>
            {resultados.map((g) => (
              <div key={g.nombre} className="zona-resultado">
                <div className="zona-resultado-nombre">{g.nombre}</div>
                <div className="zona-resultado-extraccionistas">
                  {g.extraccionistas.join(' · ')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
