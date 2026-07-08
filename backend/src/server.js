import 'dotenv/config';
import { createApp } from './app.js';
import { ensureInit } from './db.js';

const app = createApp();
const PORT = process.env.PORT || 4000;

await ensureInit();

app.listen(PORT, () => {
  console.log(`API de turnos escuchando en http://localhost:${PORT}`);
});
