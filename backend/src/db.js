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

// Esquema para instalaciones nuevas (sin datos previos).
const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    usuario TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    rol TEXT NOT NULL CHECK (rol IN ('extraccionista', 'diagnotest', 'admin')),
    nombre TEXT NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS turnos (
    id SERIAL PRIMARY KEY,
    tutor TEXT NOT NULL,
    telefono TEXT,
    direccion TEXT,
    email TEXT,
    fecha TEXT NOT NULL,
    hora_inicio TEXT NOT NULL,
    hora_fin TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'pendiente'
      CHECK (estado IN ('pendiente', 'confirmado', 'rechazado', 'cancelado')),
    motivo_rechazo TEXT,
    numero_dt TEXT,
    respondido_en TIMESTAMPTZ,
    creado_por INTEGER REFERENCES usuarios(id),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    recordatorio_enviado BOOLEAN NOT NULL DEFAULT false
  );
`;

// Migraciones aditivas/idempotentes para instalaciones ya existentes, que
// todavia pueden tener el esquema viejo (propietarios, roles antiguos,
// columnas de token, etc.). Cada sentencia es segura de correr mas de una
// vez.
const MIGRACIONES_SQL = `
  ALTER TABLE turnos ADD COLUMN IF NOT EXISTS tutor TEXT;
  ALTER TABLE turnos ADD COLUMN IF NOT EXISTS telefono TEXT;
  ALTER TABLE turnos ADD COLUMN IF NOT EXISTS direccion TEXT;
  ALTER TABLE turnos ADD COLUMN IF NOT EXISTS numero_dt TEXT;
  ALTER TABLE turnos ADD COLUMN IF NOT EXISTS email TEXT;
  ALTER TABLE turnos ADD COLUMN IF NOT EXISTS recordatorio_enviado BOOLEAN NOT NULL DEFAULT false;
  UPDATE turnos SET tutor = 'Sin dato' WHERE tutor IS NULL;
  ALTER TABLE turnos ALTER COLUMN tutor SET NOT NULL;
  ALTER TABLE turnos DROP COLUMN IF EXISTS propietario_id;
  ALTER TABLE turnos DROP COLUMN IF EXISTS titulo;
  ALTER TABLE turnos DROP COLUMN IF EXISTS descripcion;
  ALTER TABLE turnos DROP COLUMN IF EXISTS token;
  ALTER TABLE turnos DROP COLUMN IF EXISTS token_expira;
  DROP TABLE IF EXISTS propietarios CASCADE;
  DROP TABLE IF EXISTS admins;

  ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
  UPDATE usuarios SET rol = 'extraccionista' WHERE rol = 'cargador';
  UPDATE usuarios SET rol = 'diagnotest' WHERE rol = 'confirmador';
  ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check
    CHECK (rol IN ('extraccionista', 'diagnotest', 'admin'));

  CREATE INDEX IF NOT EXISTS idx_turnos_fecha ON turnos(fecha);
  CREATE INDEX IF NOT EXISTS idx_turnos_creado_por ON turnos(creado_por);

  -- Evita que una misma extraccionista tenga dos turnos activos en el
  -- mismo horario (la disponibilidad ya lo filtra del lado de la app,
  -- esto es una red de seguridad ante pedidos simultaneos).
  CREATE UNIQUE INDEX IF NOT EXISTS idx_turnos_horario_unico
    ON turnos(creado_por, fecha, hora_inicio)
    WHERE estado IN ('pendiente', 'confirmado');
`;

const USUARIOS_INICIALES = [
  {
    envUser: 'JIMENA_USER',
    envPass: 'JIMENA_PASSWORD',
    defaultUser: 'jimena',
    defaultPass: 'jimena',
    rol: 'extraccionista',
    nombre: 'Jimena',
  },
  {
    envUser: 'DANIELA_USER',
    envPass: 'DANIELA_PASSWORD',
    defaultUser: 'daniela',
    defaultPass: 'daniela',
    rol: 'extraccionista',
    nombre: 'Daniela',
  },
  {
    envUser: 'DIAGNOTEST_USER',
    envPass: 'DIAGNOTEST_PASSWORD',
    defaultUser: 'diagnotest',
    defaultPass: 'diagnotest',
    rol: 'diagnotest',
    nombre: 'Diagnotest',
  },
  {
    envUser: 'ADMIN_USER',
    envPass: 'ADMIN_PASSWORD',
    defaultUser: 'admin',
    defaultPass: 'admin',
    rol: 'admin',
    nombre: 'Admin',
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
    initPromise = pool
      .query(SCHEMA_SQL)
      .then(() => pool.query(MIGRACIONES_SQL))
      .then(() => ensureUsuarios());
  }
  return initPromise;
}
