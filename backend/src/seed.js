import 'dotenv/config';
import { pool, ensureInit } from './db.js';

await ensureInit();
console.log('Base de datos lista (tablas creadas y usuarios iniciales verificados).');
await pool.end();
