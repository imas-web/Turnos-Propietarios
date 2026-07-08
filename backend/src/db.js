import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pg;

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_POSTGRES_URL;
const isLocal = /localhost|127\.0\.0\.1/.test(connectionString || '');

export const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    usuario TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS propietarios (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    email TEXT NOT NULL,
    telefono TEXT,
    unidad TEXT NOT NULL,
    activo INTEGER NOT NULL DEFAULT 1,
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
    token TEXT UNIQUE NOT NULL,
    token_expira TIMESTAMPTZ,
    respondido_en TIMESTAMPTZ,
    motivo_rechazo TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_turnos_propietario ON turnos(propietario_id);
  CREATE INDEX IF NOT EXISTS idx_turnos_fecha ON turnos(fecha);
  CREATE INDEX IF NOT EXISTS idx_turnos_token ON turnos(token);
`;

async function ensureAdmin() {
  const usuario = process.env.ADMIN_USER || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const { rows } = await pool.query('SELECT id FROM admins WHERE usuario = $1', [usuario]);
  if (rows.length === 0) {
    const hash = bcrypt.hashSync(password, 10);
    await pool.query('INSERT INTO admins (usuario, password_hash) VALUES ($1, $2)', [
      usuario,
      hash,
    ]);
    console.log(`Usuario administrador creado: ${usuario}`);
  }
}

let initPromise;

// Crea las tablas y el admin inicial la primera vez que se necesita la base.
// En serverless (Vercel) esto corre una vez por instancia "cold start" y
// despues queda memoizado durante la vida de esa instancia.
export function ensureInit() {
  if (!initPromise) {
    initPromise = pool.query(SCHEMA_SQL).then(() => ensureAdmin());
  }
  return initPromise;
}
