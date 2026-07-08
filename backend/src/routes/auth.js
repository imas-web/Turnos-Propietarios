import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { ah } from '../utils/asyncHandler.js';

const router = Router();

router.post(
  '/login',
  ah(async (req, res) => {
    const { usuario, password } = req.body || {};
    if (!usuario || !password) {
      return res.status(400).json({ error: 'Usuario y contrasena son requeridos' });
    }

    const { rows } = await pool.query('SELECT * FROM admins WHERE usuario = $1', [usuario]);
    const admin = rows[0];
    if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }

    const token = jwt.sign(
      { sub: admin.id, usuario: admin.usuario },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '12h' }
    );

    res.json({ token, usuario: admin.usuario });
  })
);

export default router;
