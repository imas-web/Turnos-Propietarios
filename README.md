# Turnos Propietarios

Aplicación para gestionar turnos de extracción con tres tipos de acceso:
dos usuarias que cargan turnos (**Jimena** y **Daniela**) y un usuario que los
confirma o rechaza (**Diagnotest**). Cada cargadora ve únicamente los turnos
y propietarios que ella misma creó; Diagnotest ve todos los turnos pendientes
de ambas y los resuelve desde el panel, sin necesidad de links públicos ni
correos.

## Estructura

```
backend/    API REST (Express + Postgres)
frontend/   Panel (React + Vite)
```

## Funcionalidad

- **Login por usuario** (JWT), con tres cuentas: `jimena`, `daniela`
  (rol "cargador") y `diagnotest` (rol "confirmador").
- **Cargador** (Jimena/Daniela): ABM de sus propios propietarios, y ABM de
  sus propios turnos (título, descripción, fecha y horario). No ve los
  turnos ni propietarios de la otra cargadora.
- **Confirmador** (Diagnotest): ve todos los turnos pendientes (de
  cualquier cargadora) y los **confirma** o **rechaza** (con motivo
  opcional) desde el panel.
- Estados de turno: `pendiente`, `confirmado`, `rechazado`, `cancelado`.

## Requisitos

- Node.js 18 o superior.
- Una base de datos Postgres (local, o gratuita en la nube: Neon, Vercel Postgres, Supabase, etc.).

## Backend

```bash
cd backend
cp .env.example .env   # completar DATABASE_URL con tu conexion a Postgres
npm install
npm run seed   # crea las tablas y los usuarios iniciales (opcional, se crean solos igual al arrancar)
npm run dev    # http://localhost:4000
```

Usuarios iniciales por defecto (configurables en `.env`):

| Usuario      | Contraseña   | Rol         |
|--------------|--------------|-------------|
| `jimena`     | `jimena`     | cargador    |
| `daniela`    | `daniela`    | cargador    |
| `diagnotest` | `diagnotest` | confirmador |

### Tests

```bash
cd backend
npm test
```

## Frontend

```bash
cd frontend
npm install
npm run dev    # http://localhost:5173
```

En desarrollo, Vite redirige `/api/*` hacia `http://localhost:4000` (ver
`vite.config.js`), así que no hace falta configurar CORS manualmente.

## Flujo típico

1. Jimena (o Daniela) inicia sesión, carga sus propietarios y crea turnos
   para ellos. Quedan en estado `pendiente`.
2. Diagnotest inicia sesión y ve la lista de turnos pendientes de ambas
   cargadoras, y los confirma o rechaza (con motivo opcional).
3. Cuando Jimena/Daniela vuelven a entrar, ven el estado actualizado de
   sus propios turnos.

## Variables de entorno (backend)

Ver `backend/.env.example`. Lo más relevante:

- `DATABASE_URL`: cadena de conexión a Postgres.
- `JWT_SECRET`: secreto para firmar los tokens de sesión.
- `JIMENA_USER` / `JIMENA_PASSWORD`, `DANIELA_USER` / `DANIELA_PASSWORD`,
  `DIAGNOTEST_USER` / `DIAGNOTEST_PASSWORD`: credenciales de los tres
  usuarios iniciales (se crean solos la primera vez que arranca el server
  si no existen).

## Deploy en Vercel

El repo está preparado para desplegarse como **dos proyectos de Vercel separados**
(uno para `backend`, otro para `frontend`), cada uno con su propia URL pública.

### 1. Backend

1. En Vercel, "Add New... → Project", importá este repo y elegí la carpeta
   `backend` como raíz del proyecto ("Root Directory").
2. Antes de desplegar, andá a la pestaña **Storage** del proyecto y creá una
   base **Postgres**. Esto agrega automáticamente una variable de conexión
   al proyecto (`DATABASE_URL`, `POSTGRES_URL` o `DATABASE_POSTGRES_URL`
   según el proveedor; el backend reconoce cualquiera de las tres).
3. En **Settings → Environment Variables**, agregá también:
   - `JWT_SECRET` (cualquier cadena larga y aleatoria)
   - Opcionalmente, credenciales propias para `JIMENA_USER`/`JIMENA_PASSWORD`,
     etc., si no querés usar las contraseñas por defecto.
4. Desplegá. Las tablas y los usuarios iniciales se crean solos en el
   primer pedido (no hace falta correr ninguna migración a mano).

### 2. Frontend

1. "Add New... → Project", mismo repo, raíz `frontend`.
2. En **Environment Variables**, agregá `VITE_API_URL` con la URL pública del
   backend desplegado en el paso anterior (por ejemplo
   `https://tu-backend.vercel.app/api`).
3. Desplegá.
