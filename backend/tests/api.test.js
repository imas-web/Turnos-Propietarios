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
const { fechaYHoraActualEnArgentina, sumarDias } = await import('../src/utils/fechaArgentina.js');
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

const FECHA_FUTURA = '2030-06-10';

before(async () => {
  await ensureInit();
  await pool.query('TRUNCATE turnos RESTART IDENTITY CASCADE');

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
  const res = await request(app).get('/api/turnos');
  assert.equal(res.status, 401);
});

test('jimena ve horarios disponibles cada 30 minutos entre 08:00 y 20:00', async () => {
  const res = await request(app)
    .get(`/api/turnos/disponibilidad?fecha=${FECHA_FUTURA}`)
    .set('Authorization', `Bearer ${jimenaToken}`);

  assert.equal(res.status, 200);
  assert.ok(res.body.slots.includes('08:00'));
  assert.ok(res.body.slots.includes('19:30'));
  assert.ok(!res.body.slots.includes('20:00'));
  assert.equal(res.body.slots.length, 24);
});

let turnoJimenaId;

test('jimena crea un turno con tutor y telefono', async () => {
  const res = await request(app)
    .post('/api/turnos')
    .set('Authorization', `Bearer ${jimenaToken}`)
    .send({
      tutor: 'Familia Perez',
      telefono: '11-4444-5555',
      direccion: 'Av. Siempre Viva 123',
      email: 'perez@test.com',
      fecha: FECHA_FUTURA,
      hora_inicio: '10:00',
    });

  assert.equal(res.status, 201);
  assert.equal(res.body.estado, 'pendiente');
  assert.equal(res.body.hora_fin, '10:30');
  turnoJimenaId = res.body.id;
});

test('ese horario ya no aparece disponible para jimena', async () => {
  const res = await request(app)
    .get(`/api/turnos/disponibilidad?fecha=${FECHA_FUTURA}`)
    .set('Authorization', `Bearer ${jimenaToken}`);
  assert.ok(!res.body.slots.includes('10:00'));
});

test('daniela si puede tomar el mismo horario (agenda por extraccionista)', async () => {
  const res = await request(app)
    .post('/api/turnos')
    .set('Authorization', `Bearer ${danielaToken}`)
    .send({
      tutor: 'Familia Gomez',
      telefono: '11-5555-6666',
      direccion: 'Calle Falsa 456',
      email: 'gomez@test.com',
      fecha: FECHA_FUTURA,
      hora_inicio: '10:00',
    });
  assert.equal(res.status, 201);
});

test('jimena no puede crear otro turno en el mismo horario ya ocupado', async () => {
  const res = await request(app)
    .post('/api/turnos')
    .set('Authorization', `Bearer ${jimenaToken}`)
    .send({
      tutor: 'Otra familia',
      telefono: '11-0000-0000',
      direccion: 'Otra direccion 789',
      email: 'otra@test.com',
      fecha: FECHA_FUTURA,
      hora_inicio: '10:00',
    });
  assert.equal(res.status, 409);
});

test('rechaza un horario que no es multiplo de 30 minutos', async () => {
  const res = await request(app)
    .post('/api/turnos')
    .set('Authorization', `Bearer ${jimenaToken}`)
    .send({
      tutor: 'Familia Ruiz',
      telefono: '11-1111-2222',
      direccion: 'Calle Ruiz 111',
      email: 'ruiz@test.com',
      fecha: FECHA_FUTURA,
      hora_inicio: '10:07',
    });
  assert.equal(res.status, 400);
});

test('daniela no ve los turnos de jimena', async () => {
  const res = await request(app)
    .get('/api/turnos')
    .set('Authorization', `Bearer ${danielaToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 1);
  assert.equal(res.body[0].tutor, 'Familia Gomez');
});

test('diagnotest ve todos los turnos pendientes de todas las extraccionistas', async () => {
  const res = await request(app)
    .get('/api/turnos')
    .set('Authorization', `Bearer ${diagnotestToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 2);
});

test('jimena no puede confirmar turnos (solo diagnotest)', async () => {
  const res = await request(app)
    .post(`/api/turnos/${turnoJimenaId}/confirmar`)
    .set('Authorization', `Bearer ${jimenaToken}`);
  assert.equal(res.status, 403);
});

test('diagnotest no puede confirmar sin numero de DT', async () => {
  const res = await request(app)
    .post(`/api/turnos/${turnoJimenaId}/confirmar`)
    .set('Authorization', `Bearer ${diagnotestToken}`)
    .send({});
  assert.equal(res.status, 400);
});

test('diagnotest confirma un turno pendiente con numero de DT', async () => {
  const res = await request(app)
    .post(`/api/turnos/${turnoJimenaId}/confirmar`)
    .set('Authorization', `Bearer ${diagnotestToken}`)
    .send({ numero_dt: 'DT-001' });
  assert.equal(res.status, 200);
  assert.equal(res.body.estado, 'confirmado');
  assert.equal(res.body.numero_dt, 'DT-001');

  const segundaVez = await request(app)
    .post(`/api/turnos/${turnoJimenaId}/confirmar`)
    .set('Authorization', `Bearer ${diagnotestToken}`)
    .send({ numero_dt: 'DT-002' });
  assert.equal(segundaVez.status, 409);
});

test('diagnotest ve la lista de extraccionistas para la grilla', async () => {
  const res = await request(app)
    .get('/api/turnos/extraccionistas')
    .set('Authorization', `Bearer ${diagnotestToken}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.some((u) => u.nombre === 'Jimena'));
  assert.ok(res.body.some((u) => u.nombre === 'Daniela'));
});

test('jimena no puede ver la lista de extraccionistas (solo diagnotest)', async () => {
  const res = await request(app)
    .get('/api/turnos/extraccionistas')
    .set('Authorization', `Bearer ${jimenaToken}`);
  assert.equal(res.status, 403);
});

test('diagnotest rechaza un turno pendiente con motivo', async () => {
  const creado = await request(app)
    .post('/api/turnos')
    .set('Authorization', `Bearer ${jimenaToken}`)
    .send({
      tutor: 'Familia a rechazar',
      telefono: '11-9999-8888',
      direccion: 'Calle a rechazar 222',
      email: 'rechazo@test.com',
      fecha: FECHA_FUTURA,
      hora_inicio: '11:00',
    });

  const rechazo = await request(app)
    .post(`/api/turnos/${creado.body.id}/rechazar`)
    .set('Authorization', `Bearer ${diagnotestToken}`)
    .send({ motivo: 'Paciente no disponible' });

  assert.equal(rechazo.status, 200);
  assert.equal(rechazo.body.estado, 'rechazado');
  assert.equal(rechazo.body.motivo_rechazo, 'Paciente no disponible');
});

test('el horario de un turno rechazado vuelve a estar disponible', async () => {
  const res = await request(app)
    .get(`/api/turnos/disponibilidad?fecha=${FECHA_FUTURA}`)
    .set('Authorization', `Bearer ${jimenaToken}`);
  assert.ok(res.body.slots.includes('11:00'));
});

test('a jimena no se le muestran sus propios turnos rechazados', async () => {
  const res = await request(app)
    .get('/api/turnos')
    .set('Authorization', `Bearer ${jimenaToken}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.every((t) => t.estado !== 'rechazado'));

  const conFiltro = await request(app)
    .get('/api/turnos?estado=rechazado')
    .set('Authorization', `Bearer ${jimenaToken}`);
  assert.equal(conFiltro.body.length, 0);
});

test('diagnotest si ve los turnos rechazados', async () => {
  const res = await request(app)
    .get('/api/turnos?estado=rechazado')
    .set('Authorization', `Bearer ${diagnotestToken}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.some((t) => t.tutor === 'Familia a rechazar'));
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

test('admin no puede eliminar una extraccionista con turnos asociados', async () => {
  const listado = await request(app)
    .get('/api/usuarios')
    .set('Authorization', `Bearer ${adminToken}`);
  const jimena = listado.body.find((u) => u.usuario === 'jimena');

  const res = await request(app)
    .delete(`/api/usuarios/${jimena.id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 409);
});

test('el cron de recordatorios envia solo turnos confirmados para manana y los marca', async () => {
  const manana = sumarDias(fechaYHoraActualEnArgentina().fecha, 1);

  const creado = await request(app)
    .post('/api/turnos')
    .set('Authorization', `Bearer ${jimenaToken}`)
    .send({
      tutor: 'Familia Recordatorio',
      telefono: '11-2222-3333',
      direccion: 'Calle Recordatorio 1',
      email: 'recordatorio@test.com',
      fecha: manana,
      hora_inicio: '09:00',
    });
  assert.equal(creado.status, 201);

  await request(app)
    .post(`/api/turnos/${creado.body.id}/confirmar`)
    .set('Authorization', `Bearer ${diagnotestToken}`)
    .send({ numero_dt: 'DT-REC' });

  const res = await request(app).get('/api/cron/recordatorios');
  assert.equal(res.status, 200);
  assert.equal(res.body.fecha, manana);
  assert.ok(res.body.procesados >= 1);

  const turno = await request(app)
    .get(`/api/turnos/${creado.body.id}`)
    .set('Authorization', `Bearer ${jimenaToken}`);
  assert.equal(turno.body.recordatorio_enviado, true);

  const segundaVez = await request(app).get('/api/cron/recordatorios');
  assert.equal(segundaVez.status, 200);
  assert.equal(segundaVez.body.procesados, 0);
});

test('el cron de recordatorios exige el secreto cuando CRON_SECRET esta configurado', async () => {
  process.env.CRON_SECRET = 'un-secreto';
  try {
    const sinAuth = await request(app).get('/api/cron/recordatorios');
    assert.equal(sinAuth.status, 401);

    const conAuth = await request(app)
      .get('/api/cron/recordatorios')
      .set('Authorization', 'Bearer un-secreto');
    assert.equal(conAuth.status, 200);
  } finally {
    delete process.env.CRON_SECRET;
  }
});
