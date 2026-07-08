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

## Backend

```bash
cd backend
cp .env.example .env
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

- `JWT_SECRET`: secreto para firmar los tokens de sesión del administrador.
- `ADMIN_USER` / `ADMIN_PASSWORD`: credenciales del administrador inicial.
- `FRONTEND_URL`: usada para construir el link público de confirmación.
- `SMTP_*`: opcional, para enviar el link de confirmación por correo.
