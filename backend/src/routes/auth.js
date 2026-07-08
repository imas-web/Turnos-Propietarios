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

    const { rows } = await pool.query('SELECT * FROM usuarios WHERE usuario = $1', [usuario]);
    const user = rows[0];
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }

    const token = jwt.sign(
      { sub: user.id, usuario: user.usuario, rol: user.rol, nombre: user.nombre },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '12h' }
    );

    res.json({ token, usuario: user.usuario, rol: user.rol, nombre: user.nombre });
  })
);

export default router;
