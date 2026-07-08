import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pg;

const rawConnectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_POSTGRES_URL;
const isLocal = /localhost|127\.0\.0\.1/.test(rawConnectionString || '');

// Algunos proveedores (Supabase, etc.) incluyen "sslmode" en la cadena de
// conexion, lo que hace que pg use su propia validacion estricta de
// certificado en vez de la opcion "ssl" que le pasamos aca abajo. Se quita
// para que la configuracion de ssl sea siempre la que definimos nosotros.
function limpiarSslMode(url) {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete('sslmode');
    return parsed.toString();
  } catch {
    return url;
  }
}

const connectionString = limpiarSslMode(rawConnectionString);

export const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    usuario TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    rol TEXT NOT NULL CHECK (rol IN ('cargador', 'confirmador')),
    nombre TEXT NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS propietarios (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    email TEXT NOT NULL,
    telefono TEXT,
    unidad TEXT NOT NULL,
    activo INTEGER NOT NULL DEFAULT 1,
    creado_por INTEGER REFERENCES usuarios(id),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS turnos (
    id SERIAL PRIMARY KEY,
    propietario_id INTEGER NOT NULL REFERENCES propietarios(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    descripcion TEXT,
    fecha TEXT NOT NULL,
    hora_inicio TEXT NOT NULL,
    hora_fin TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'pendiente'
      CHECK (estado IN ('pendiente', 'confirmado', 'rechazado', 'cancelado')),
    motivo_rechazo TEXT,
    respondido_en TIMESTAMPTZ,
    creado_por INTEGER REFERENCES usuarios(id),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  ALTER TABLE propietarios ADD COLUMN IF NOT EXISTS creado_por INTEGER REFERENCES usuarios(id);
  ALTER TABLE turnos ADD COLUMN IF NOT EXISTS creado_por INTEGER REFERENCES usuarios(id);
  ALTER TABLE turnos DROP COLUMN IF EXISTS token;
  ALTER TABLE turnos DROP COLUMN IF EXISTS token_expira;
  DROP TABLE IF EXISTS admins;

  CREATE INDEX IF NOT EXISTS idx_turnos_propietario ON turnos(propietario_id);
  CREATE INDEX IF NOT EXISTS idx_turnos_fecha ON turnos(fecha);
  CREATE INDEX IF NOT EXISTS idx_turnos_creado_por ON turnos(creado_por);
  CREATE INDEX IF NOT EXISTS idx_propietarios_creado_por ON propietarios(creado_por);
`;

const USUARIOS_INICIALES = [
  {
    envUser: 'JIMENA_USER',
    envPass: 'JIMENA_PASSWORD',
    defaultUser: 'jimena',
    defaultPass: 'jimena',
    rol: 'cargador',
    nombre: 'Jimena',
  },
  {
    envUser: 'DANIELA_USER',
    envPass: 'DANIELA_PASSWORD',
    defaultUser: 'daniela',
    defaultPass: 'daniela',
    rol: 'cargador',
    nombre: 'Daniela',
  },
  {
    envUser: 'DIAGNOTEST_USER',
    envPass: 'DIAGNOTEST_PASSWORD',
    defaultUser: 'diagnotest',
    defaultPass: 'diagnotest',
    rol: 'confirmador',
    nombre: 'Diagnotest',
  },
];

async function ensureUsuarios() {
  for (const u of USUARIOS_INICIALES) {
    const usuario = process.env[u.envUser] || u.defaultUser;
    const password = process.env[u.envPass] || u.defaultPass;
    const { rows } = await pool.query('SELECT id FROM usuarios WHERE usuario = $1', [usuario]);
    if (rows.length === 0) {
      const hash = bcrypt.hashSync(password, 10);
      await pool.query(
        'INSERT INTO usuarios (usuario, password_hash, rol, nombre) VALUES ($1, $2, $3, $4)',
        [usuario, hash, u.rol, u.nombre]
      );
      console.log(`Usuario creado: ${usuario} (${u.rol})`);
    }
  }
}

let initPromise;

// Crea/actualiza las tablas y los usuarios iniciales la primera vez que se
// necesita la base. En serverless (Vercel) esto corre una vez por instancia
// "cold start" y despues queda memoizado durante la vida de esa instancia.
export function ensureInit() {
  if (!initPromise) {
    initPromise = pool.query(SCHEMA_SQL).then(() => ensureUsuarios());
  }
  return initPromise;
}
