const TITULO_BASE = document.title;

let faviconLink = null;

function obtenerFaviconLink() {
  if (!faviconLink) {
    faviconLink = document.querySelector('link[rel="icon"]');
    if (!faviconLink) {
      faviconLink = document.createElement('link');
      faviconLink.rel = 'icon';
      document.head.appendChild(faviconLink);
    }
  }
  return faviconLink;
}

function dibujarIconoBase(ctx, size) {
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#1e6b34';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${size * 0.55}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('D', size / 2, size / 2 + size * 0.03);
}

// Dibuja, como en WhatsApp Web, un globito rojo con la cantidad sobre el
// icono de la pestana, y actualiza el titulo de la pagina a la par.
export function actualizarBadgePendientes(cantidad) {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  dibujarIconoBase(ctx, size);

  if (cantidad > 0) {
    const texto = cantidad > 99 ? '99+' : String(cantidad);
    const radio = texto.length > 2 ? size * 0.28 : size * 0.22;
    const cx = size - radio * 0.9;
    const cy = radio * 0.9;

    ctx.beginPath();
    ctx.arc(cx, cy, radio, 0, Math.PI * 2);
    ctx.fillStyle = '#dc2626';
    ctx.fill();
    ctx.lineWidth = size * 0.035;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${texto.length > 2 ? size * 0.2 : size * 0.28}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(texto, cx, cy + size * 0.02);
  }

  obtenerFaviconLink().href = canvas.toDataURL('image/png');
  document.title = cantidad > 0 ? `(${cantidad > 99 ? '99+' : cantidad}) ${TITULO_BASE}` : TITULO_BASE;
}
