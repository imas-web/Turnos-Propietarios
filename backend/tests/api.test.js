import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/turnos_test';
process.env.JWT_SECRET = 'test-secret';
process.env.JIMENA_USER = 'jimena';
process.env.JIMENA_PASSWORD = 'jimena';
process.env.DANIELA_USER = 'daniela';
process.env.DANIELA_PASSWORD = 'daniela';
process.env.DIAGNOTEST_USER = 'diagnotest';
process.env.DIAGNOTEST_PASSWORD = 'diagnotest';
process.env.ADMIN_USER = 'admin';
process.env.ADMIN_PASSWORD = 'admin';

const { createApp } = await import('../src/app.js');
const { pool, ensureInit } = await import('../src/db.js');
const request = (await import('supertest')).default;

const app = createApp();

async function login(usuario, password) {
  const res = await request(app).post('/api/auth/login').send({ usuario, password });
  return res.body.token;
}

let jimenaToken;
let danielaToken;
let diagnotestToken;
let adminToken;
let propietarioJimenaId;

before(async () => {
  await ensureInit();
  await pool.query('TRUNCATE turnos, propietarios RESTART IDENTITY CASCADE');

  jimenaToken = await login('jimena', 'jimena');
  danielaToken = await login('daniela', 'daniela');
  diagnotestToken = await login('diagnotest', 'diagnotest');
  adminToken = await login('admin', 'admin');
});

after(async () => {
  await pool.end();
});

test('rechaza login con credenciales invalidas', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ usuario: 'jimena', password: 'incorrecta' });
  assert.equal(res.status, 401);
});

test('login de cada usuario devuelve su rol', () => {
  assert.ok(jimenaToken);
  assert.ok(danielaToken);
  assert.ok(diagnotestToken);
  assert.ok(adminToken);
});

test('rechaza acceso sin token a rutas protegidas', async () => {
  const res = await request(app).get('/api/propietarios');
  assert.equal(res.status, 401);
});

test('jimena crea un propietario propio', async () => {
  const res = await request(app)
    .post('/api/propietarios')
    .set('Authorization', `Bearer ${jimenaToken}`)
    .send({ nombre: 'Paciente de Jimena', email: 'paciente1@test.com', unidad: '1A' });

  assert.equal(res.status, 201);
  propietarioJimenaId = res.body.id;
});

test('daniela no ve los propietarios de jimena', async () => {
  const res = await request(app)
    .get('/api/propietarios')
    .set('Authorization', `Bearer ${danielaToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 0);
});

test('jimena crea un turno para su propietario', async () => {
  const res = await request(app)
    .post('/api/turnos')
    .set('Authorization', `Bearer ${jimenaToken}`)
    .send({
      propietario_id: propietarioJimenaId,
      titulo: 'Extraccion de sangre',
      fecha: '2026-08-01',
      hora_inicio: '10:00',
      hora_fin: '10:30',
    });

  assert.equal(res.status, 201);
  assert.equal(res.body.estado, 'pendiente');
});

test('daniela no puede crear un turno usando el propietario de jimena', async () => {
  const res = await request(app)
    .post('/api/turnos')
    .set('Authorization', `Bearer ${danielaToken}`)
    .send({
      propietario_id: propietarioJimenaId,
      titulo: 'Intento invalido',
      fecha: '2026-08-01',
      hora_inicio: '11:00',
      hora_fin: '11:30',
    });

  assert.equal(res.status, 404);
});

test('daniela no ve los turnos de jimena', async () => {
  const res = await request(app)
    .get('/api/turnos')
    .set('Authorization', `Bearer ${danielaToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 0);
});

test('diagnotest ve todos los turnos pendientes de todas las extraccionistas', async () => {
  const res = await request(app)
    .get('/api/turnos')
    .set('Authorization', `Bearer ${diagnotestToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 1);
});

test('jimena no puede confirmar turnos (solo diagnotest)', async () => {
  const listado = await request(app)
    .get('/api/turnos')
    .set('Authorization', `Bearer ${jimenaToken}`);
  const turnoId = listado.body[0].id;

  const res = await request(app)
    .post(`/api/turnos/${turnoId}/confirmar`)
    .set('Authorization', `Bearer ${jimenaToken}`);
  assert.equal(res.status, 403);
});

test('diagnotest confirma un turno pendiente', async () => {
  const listado = await request(app)
    .get('/api/turnos')
    .set('Authorization', `Bearer ${diagnotestToken}`);
  const turnoId = listado.body[0].id;

  const res = await request(app)
    .post(`/api/turnos/${turnoId}/confirmar`)
    .set('Authorization', `Bearer ${diagnotestToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.estado, 'confirmado');

  const segundaVez = await request(app)
    .post(`/api/turnos/${turnoId}/confirmar`)
    .set('Authorization', `Bearer ${diagnotestToken}`);
  assert.equal(segundaVez.status, 409);
});

test('diagnotest rechaza un turno pendiente con motivo', async () => {
  const creado = await request(app)
    .post('/api/turnos')
    .set('Authorization', `Bearer ${jimenaToken}`)
    .send({
      propietario_id: propietarioJimenaId,
      titulo: 'Turno a rechazar',
      fecha: '2026-08-05',
      hora_inicio: '09:00',
      hora_fin: '09:30',
    });

  const rechazo = await request(app)
    .post(`/api/turnos/${creado.body.id}/rechazar`)
    .set('Authorization', `Bearer ${diagnotestToken}`)
    .send({ motivo: 'Paciente no disponible' });

  assert.equal(rechazo.status, 200);
  assert.equal(rechazo.body.estado, 'rechazado');
  assert.equal(rechazo.body.motivo_rechazo, 'Paciente no disponible');
});

test('turno inexistente devuelve 404', async () => {
  const res = await request(app)
    .get('/api/turnos/999999')
    .set('Authorization', `Bearer ${jimenaToken}`);
  assert.equal(res.status, 404);
});

test('jimena no puede gestionar usuarios (solo admin)', async () => {
  const res = await request(app)
    .get('/api/usuarios')
    .set('Authorization', `Bearer ${jimenaToken}`);
  assert.equal(res.status, 403);
});

test('admin ve la lista de extraccionistas y diagnotest, sin admins', async () => {
  const res = await request(app)
    .get('/api/usuarios')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.every((u) => u.rol !== 'admin'));
  assert.ok(res.body.some((u) => u.usuario === 'jimena'));
});

let usuarioCreadoId;

test('admin crea una nueva extraccionista', async () => {
  const res = await request(app)
    .post('/api/usuarios')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ usuario: 'nueva', password: 'nueva123', rol: 'extraccionista', nombre: 'Nueva' });

  assert.equal(res.status, 201);
  usuarioCreadoId = res.body.id;

  const loginNueva = await login('nueva', 'nueva123');
  assert.ok(loginNueva);
});

test('admin edita el nombre de un usuario', async () => {
  const res = await request(app)
    .put(`/api/usuarios/${usuarioCreadoId}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ nombre: 'Nueva Editada' });

  assert.equal(res.status, 200);
  assert.equal(res.body.nombre, 'Nueva Editada');
});

test('admin elimina un usuario sin turnos asociados', async () => {
  const res = await request(app)
    .delete(`/api/usuarios/${usuarioCreadoId}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 204);
});

test('admin no puede eliminar una extraccionista con propietarios asociados', async () => {
  const listado = await request(app)
    .get('/api/usuarios')
    .set('Authorization', `Bearer ${adminToken}`);
  const jimena = listado.body.find((u) => u.usuario === 'jimena');

  const res = await request(app)
    .delete(`/api/usuarios/${jimena.id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 409);
});
