import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/turnos_test';
process.env.JWT_SECRET = 'test-secret';
process.env.ADMIN_USER = 'admin';
process.env.ADMIN_PASSWORD = 'admin123';
process.env.FRONTEND_URL = 'http://localhost:5173';

const { createApp } = await import('../src/app.js');
const { pool, ensureInit } = await import('../src/db.js');
const request = (await import('supertest')).default;

const app = createApp();
let adminToken;
let propietarioId;

before(async () => {
  await ensureInit();
  await pool.query('TRUNCATE turnos, propietarios RESTART IDENTITY CASCADE');

  const res = await request(app)
    .post('/api/auth/login')
    .send({ usuario: 'admin', password: 'admin123' });
  adminToken = res.body.token;
});

after(async () => {
  await pool.end();
});

test('rechaza login con credenciales invalidas', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ usuario: 'admin', password: 'incorrecta' });
  assert.equal(res.status, 401);
});

test('login exitoso devuelve token', () => {
  assert.ok(adminToken && adminToken.length > 10);
});

test('rechaza acceso sin token a rutas protegidas', async () => {
  const res = await request(app).get('/api/propietarios');
  assert.equal(res.status, 401);
});

test('crea un propietario', async () => {
  const res = await request(app)
    .post('/api/propietarios')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ nombre: 'Test Owner', email: 'owner@test.com', unidad: '5D' });

  assert.equal(res.status, 201);
  assert.equal(res.body.nombre, 'Test Owner');
  propietarioId = res.body.id;
});

test('crea un turno asignado al propietario y genera link de confirmacion', async () => {
  const res = await request(app)
    .post('/api/turnos')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      propietario_id: propietarioId,
      titulo: 'Turno de prueba',
      fecha: '2026-08-01',
      hora_inicio: '10:00',
      hora_fin: '11:00',
    });

  assert.equal(res.status, 201);
  assert.equal(res.body.estado, 'pendiente');
  assert.ok(res.body.link_confirmacion.includes('/confirmar/'));
});

test('flujo completo de confirmacion publica por token', async () => {
  const listado = await request(app)
    .get('/api/turnos')
    .set('Authorization', `Bearer ${adminToken}`);
  const turno = listado.body.find((t) => t.propietario_id === propietarioId);
  const token = turno.token;

  const publico = await request(app).get(`/api/confirmacion/${token}`);
  assert.equal(publico.status, 200);
  assert.equal(publico.body.estado, 'pendiente');
  assert.equal(publico.body.token, undefined);

  const confirmar = await request(app).post(`/api/confirmacion/${token}/confirmar`);
  assert.equal(confirmar.status, 200);
  assert.equal(confirmar.body.estado, 'confirmado');

  const segundaVez = await request(app).post(`/api/confirmacion/${token}/confirmar`);
  assert.equal(segundaVez.status, 409);
});

test('rechazar un turno pendiente registra el motivo', async () => {
  const creado = await request(app)
    .post('/api/turnos')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      propietario_id: propietarioId,
      titulo: 'Turno a rechazar',
      fecha: '2026-08-05',
      hora_inicio: '09:00',
      hora_fin: '10:00',
    });

  const token = creado.body.token;
  const rechazo = await request(app)
    .post(`/api/confirmacion/${token}/rechazar`)
    .send({ motivo: 'No puedo asistir' });

  assert.equal(rechazo.status, 200);
  assert.equal(rechazo.body.estado, 'rechazado');
  assert.equal(rechazo.body.motivo_rechazo, 'No puedo asistir');
});

test('token inexistente devuelve 404', async () => {
  const res = await request(app).get('/api/confirmacion/token-que-no-existe');
  assert.equal(res.status, 404);
});
