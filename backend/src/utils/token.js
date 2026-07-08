import { randomUUID } from 'node:crypto';

export function generarToken() {
  return randomUUID();
}
