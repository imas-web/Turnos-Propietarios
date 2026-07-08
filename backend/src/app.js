import express from 'express';
import cors from 'cors';
import { ensureInit } from './db.js';
import authRoutes from './routes/auth.js';
import turnosRoutes from './routes/turnos.js';
import usuariosRoutes from './routes/usuarios.js';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use((req, res, next) => {
    ensureInit().then(() => next(), next);
  });

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  app.use('/api/auth', authRoutes);
  app.use('/api/turnos', turnosRoutes);
  app.use('/api/usuarios', usuariosRoutes);

  app.use((req, res) => {
    res.status(404).json({ error: 'Recurso no encontrado' });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  });

  return app;
}
