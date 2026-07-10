# Turnos Propietarios

Aplicación para gestionar turnos de extracción con distintos tipos de acceso:
usuarias "extraccionista" que cargan sus propios turnos (por ejemplo Jimena y
Daniela), un usuario "diagnotest" que los confirma o rechaza, y un usuario
"admin" que gestiona las cuentas de extraccionista/diagnotest. Cada
extraccionista ve únicamente los turnos que ella misma creó, en una agenda
pensada para celular; diagnotest ve todos los turnos de todas (con una
barra lateral de pendientes por confirmar) y los resuelve desde el panel,
sin necesidad de links públicos ni correos.

## Estructura

```
backend/    API REST (Express + Postgres)
frontend/   Panel (React + Vite)
```

## Funcionalidad

- **Login por usuario** (JWT), con cuatro cuentas iniciales: `jimena`,
  `daniela` (rol "extraccionista"), `diagnotest` (rol "diagnotest") y
  `admin` (rol "admin").
- **Extraccionista** (Jimena/Daniela): agenda (lista por día, filtrable por
  fecha y estado) de sus propios turnos ya otorgados, y un botón "Agregar
  turno nuevo" con Tutor, Teléfono, Dirección, Email, Día y Horario. Los
  horarios se ofrecen cada 30 minutos entre las 08:00 y las 20:00, mostrando
  únicamente los que esa extraccionista todavía tiene libres ese día. No ve
  los turnos de otra extraccionista ni los que fueron rechazados, y puede
  editar o cancelar los suyos. Al registrar el turno, se le envía un mail
  al tutor pidiéndole los datos de la mascota por WhatsApp y los datos
  bancarios para el pago.
- **Diagnotest**: ve una grilla del día (horarios en filas, una columna por
  extraccionista) con los turnos sin confirmar en rojo y los confirmados en
  verde. Un botón "Turnos pendientes de confirmación" en la barra lateral
  despliega la lista (filtrable por día) para **confirmar** (requiere
  cargar un número de DT, y dispara un correo de confirmación al tutor) o
  **rechazar** (con motivo opcional).
- **Recordatorio automático**: un día antes del turno, si quedó confirmado,
  se envía un mail de recordatorio al tutor (vía un Vercel Cron Job que
  corre una vez por día).
- **Admin**: gestiona (crea, edita, elimina) las cuentas de tipo
  extraccionista y diagnotest desde el panel.
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

| Usuario      | Contraseña   | Rol            |
|--------------|--------------|----------------|
| `jimena`     | `jimena`     | extraccionista |
| `daniela`    | `daniela`    | extraccionista |
| `diagnotest` | `diagnotest` | diagnotest     |
| `admin`      | `admin`      | admin          |

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

1. Jimena (o Daniela) inicia sesión y crea turnos indicando tutor, teléfono,
   día y horario disponible. Quedan en estado `pendiente`.
2. Diagnotest inicia sesión y ve la lista de turnos pendientes de todas las
   extraccionistas, y los confirma o rechaza (con motivo opcional).
3. Cuando Jimena/Daniela vuelven a entrar, ven el estado actualizado de
   sus propios turnos.
4. Admin inicia sesión y puede crear, editar o eliminar cuentas de
   extraccionista/diagnotest según haga falta.

## Variables de entorno (backend)

Ver `backend/.env.example`. Lo más relevante:

- `DATABASE_URL`: cadena de conexión a Postgres.
- `JWT_SECRET`: secreto para firmar los tokens de sesión.
- `JIMENA_USER` / `JIMENA_PASSWORD`, `DANIELA_USER` / `DANIELA_PASSWORD`,
  `DIAGNOTEST_USER` / `DIAGNOTEST_PASSWORD`, `ADMIN_USER` / `ADMIN_PASSWORD`:
  credenciales de los usuarios iniciales (se crean solos la primera vez que
  arranca el server si no existen).
- `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM`:
  opcionales, para enviar el correo de confirmación al tutor cuando
  Diagnotest confirma un turno. Con Gmail: `SMTP_HOST=smtp.gmail.com`,
  `SMTP_PORT=465`, `SMTP_USER` la cuenta completa, `SMTP_PASS` una
  ["contraseña de aplicación"](https://myaccount.google.com/apppasswords)
  (no la contraseña normal de la cuenta). Si se deja vacío, el correo no
  se envía y solo queda un aviso en el log del servidor.
- `CRON_SECRET`: opcional, protege el endpoint `GET /api/cron/recordatorios`
  que dispara los mails de recordatorio del día previo. Si se define en
  Vercel, Vercel mismo lo manda como header `Authorization` al invocar el
  cron (ver `backend/vercel.json`); no requiere ninguna otra configuración.

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
