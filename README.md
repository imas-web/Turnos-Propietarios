# Turnos Propietarios

Aplicación para gestionar turnos asignados a propietarios de un edificio/consorcio,
con un flujo de **confirmación por link único**: cada turno generado envía (o
muestra, si no hay SMTP configurado) un enlace público donde el propietario
puede confirmar o rechazar su asistencia sin necesidad de iniciar sesión.

## Estructura

```
backend/    API REST (Express + SQLite)
frontend/   Panel de administración (React + Vite)
```

## Funcionalidad

- **Login de administrador** (JWT).
- **ABM de propietarios**: nombre, email, teléfono, unidad.
- **ABM de turnos**: título, descripción, fecha y horario, propietario asignado.
- **Confirmación por token**: al crear un turno se genera un link único
  (`/confirmar/:token`) que el propietario usa para **confirmar** o
  **rechazar** (con motivo opcional) su turno, sin login.
- Estados de turno: `pendiente`, `confirmado`, `rechazado`, `cancelado`.
- Reenvío de link (genera un nuevo token) y cancelación de turnos desde el panel.
- Envío de correo opcional vía SMTP; si no hay SMTP configurado, el link de
  confirmación queda disponible para copiar desde el panel de administración
  (y se imprime en el log del servidor).

## Requisitos

- Node.js 18 o superior.
- Una base de datos Postgres (local, o gratuita en la nube: Neon, Vercel Postgres, Supabase, etc.).

## Backend

```bash
cd backend
cp .env.example .env   # completar DATABASE_URL con tu conexion a Postgres
npm install
npm run seed   # crea el usuario admin y datos de ejemplo (opcional)
npm run dev    # http://localhost:4000
```

Usuario administrador por defecto (configurable en `.env`): `admin` / `admin123`.

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

1. El administrador inicia sesión en el panel y carga propietarios.
2. Crea un turno y lo asigna a un propietario: se genera un link de
   confirmación único.
3. El propietario abre el link (sin necesidad de cuenta) y confirma o
   rechaza el turno, opcionalmente indicando un motivo de rechazo.
4. El panel refleja el estado actualizado (`pendiente` → `confirmado` /
   `rechazado`), y permite reenviar el link o cancelar el turno.

## Variables de entorno (backend)

Ver `backend/.env.example`. Lo más relevante:

- `DATABASE_URL`: cadena de conexión a Postgres.
- `JWT_SECRET`: secreto para firmar los tokens de sesión del administrador.
- `ADMIN_USER` / `ADMIN_PASSWORD`: credenciales del administrador inicial.
- `FRONTEND_URL`: usada para construir el link público de confirmación.
- `SMTP_*`: opcional, para enviar el link de confirmación por correo.

## Deploy en Vercel

El repo está preparado para desplegarse como **dos proyectos de Vercel separados**
(uno para `backend`, otro para `frontend`), cada uno con su propia URL pública.

### 1. Backend

1. En Vercel, "Add New... → Project", importá este repo y elegí la carpeta
   `backend` como raíz del proyecto ("Root Directory").
2. Antes de desplegar, andá a la pestaña **Storage** del proyecto y creá una
   base **Postgres** (Neon, integrada en Vercel). Esto agrega automáticamente
   una variable `DATABASE_URL` (o `POSTGRES_URL`) al proyecto.
3. En **Settings → Environment Variables**, agregá también:
   - `JWT_SECRET` (cualquier cadena larga y aleatoria)
   - `ADMIN_USER` / `ADMIN_PASSWORD` (credenciales reales del administrador)
   - `FRONTEND_URL` (la URL del proyecto de frontend, se completa/actualiza
     después del paso 2)
4. Desplegá. Las tablas y el usuario admin se crean solos en el primer pedido
   (no hace falta correr ninguna migración a mano).

### 2. Frontend

1. "Add New... → Project", mismo repo, raíz `frontend`.
2. En **Environment Variables**, agregá `VITE_API_URL` con la URL pública del
   backend desplegado en el paso anterior (por ejemplo
   `https://tu-backend.vercel.app/api`).
3. Desplegá. Una vez que tengas la URL del frontend, volvé al proyecto del
   backend y actualizá `FRONTEND_URL` con esa URL (para que los links de
   confirmación apunten al lugar correcto), y volvé a desplegar el backend.
