// Small self-contained 360° viewer for an equirectangular image. It renders on a 2D canvas on the CPU,
// so it needs no WebGL and no third-party library or CDN. Drag (mouse/touch) to look around, wheel or
// the +/- buttons to zoom, arrow keys also work.
const OUT_W = 640, OUT_H = 360, SRC_W = 2048;

export function createPanoViewer(container, src, { onError = () => {} } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = OUT_W; canvas.height = OUT_H;
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', '360 degree room view. Drag or use the arrow keys to look around.');
  Object.assign(canvas.style, { width: '100%', height: '100%', display: 'block', cursor: 'grab', touchAction: 'none', imageRendering: 'auto' });
  container.replaceChildren(canvas);
  const status = document.createElement('p');
  status.textContent = 'Loading panorama…';
  Object.assign(status.style, { position: 'absolute', margin: 0, padding: '8px 12px', color: '#fff', background: '#0008', fontSize: '12px' });
  container.style.position = 'relative';
  container.append(status);

  const context = canvas.getContext('2d');
  if (!context) { onError('canvas is not available'); return { destroy() {} }; }
  const frame = context.createImageData(OUT_W, OUT_H);
  let pixels = null, sw = 0, sh = 0;
  let yaw = 0, pitch = 0, fov = 90, dirty = true, alive = true;

  const image = new Image();
  image.onload = () => {
    try {
      sw = Math.min(SRC_W, image.naturalWidth); sh = Math.round(sw / 2);
      const buffer = document.createElement('canvas');
      buffer.width = sw; buffer.height = sh;
      const bufferContext = buffer.getContext('2d');
      bufferContext.drawImage(image, 0, 0, sw, sh);
      pixels = bufferContext.getImageData(0, 0, sw, sh).data;
      status.textContent = 'Drag to look around · scroll to zoom';
      setTimeout(() => status.remove(), 3500);
      dirty = true;
    } catch (error) { onError(error.message || 'could not read the panorama'); }
  };
  image.onerror = () => onError('the panorama image could not be loaded');
  image.src = src;

  function render() {
    const tanH = Math.tan((fov * Math.PI) / 360), tanV = tanH * OUT_H / OUT_W;
    const cp = Math.cos(pitch), sp = Math.sin(pitch), cy = Math.cos(yaw), sy = Math.sin(yaw);
    const out = frame.data;
    let o = 0;
    for (let y = 0; y < OUT_H; y++) {
      const vy = (1 - (2 * (y + 0.5)) / OUT_H) * tanV;
      for (let x = 0; x < OUT_W; x++, o += 4) {
        const vx = ((2 * (x + 0.5)) / OUT_W - 1) * tanH;
        // camera ray (vx, vy, 1) -> pitch around X -> yaw around Y
        const y1 = vy * cp + sp, z1 = -vy * sp + cp;
        const dx = vx * cy + z1 * sy, dz = -vx * sy + z1 * cy;
        const lon = Math.atan2(dx, dz), lat = Math.atan2(y1, Math.hypot(dx, dz));
        let u = Math.floor((lon / (2 * Math.PI) + 0.5) * sw), v = Math.floor((0.5 - lat / Math.PI) * sh);
        if (u >= sw) u = sw - 1; if (v >= sh) v = sh - 1; if (v < 0) v = 0;
        const s = (v * sw + u) * 4;
        out[o] = pixels[s]; out[o + 1] = pixels[s + 1]; out[o + 2] = pixels[s + 2]; out[o + 3] = 255;
      }
    }
    context.putImageData(frame, 0, 0);
  }

  function loop() {
    if (!alive || !container.isConnected) return;
    if (dirty && pixels) { dirty = false; render(); }
    requestAnimationFrame(loop);
  }
  loop();

  const limit = () => { pitch = Math.max(-1.45, Math.min(1.45, pitch)); fov = Math.max(40, Math.min(110, fov)); dirty = true; };
  let dragging = false, lastX = 0, lastY = 0;
  canvas.addEventListener('pointerdown', event => { dragging = true; lastX = event.clientX; lastY = event.clientY; canvas.setPointerCapture(event.pointerId); canvas.style.cursor = 'grabbing'; });
  canvas.addEventListener('pointermove', event => {
    if (!dragging) return;
    const scale = (fov * Math.PI) / 180 / canvas.clientWidth;
    yaw -= (event.clientX - lastX) * scale; pitch += (event.clientY - lastY) * scale;
    lastX = event.clientX; lastY = event.clientY; limit();
  });
  const stop = () => { dragging = false; canvas.style.cursor = 'grab'; };
  canvas.addEventListener('pointerup', stop); canvas.addEventListener('pointercancel', stop);
  canvas.addEventListener('wheel', event => { event.preventDefault(); fov += event.deltaY * 0.05; limit(); }, { passive: false });
  canvas.addEventListener('keydown', event => {
    const step = 0.08, moves = { ArrowLeft: () => { yaw -= step; }, ArrowRight: () => { yaw += step; }, ArrowUp: () => { pitch += step; }, ArrowDown: () => { pitch -= step; }, '+': () => { fov -= 8; }, '-': () => { fov += 8; } };
    if (moves[event.key]) { event.preventDefault(); moves[event.key](); limit(); }
  });

  const controls = document.createElement('div');
  Object.assign(controls.style, { position: 'absolute', right: '10px', top: '10px', display: 'grid', gap: '6px' });
  for (const [label, name, change] of [['+', 'Zoom in', -10], ['−', 'Zoom out', 10]]) {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = label; button.setAttribute('aria-label', name);
    Object.assign(button.style, { width: '34px', height: '34px', border: '1px solid #0004', background: '#fff', fontSize: '20px', cursor: 'pointer' });
    button.addEventListener('click', () => { fov += change; limit(); });
    controls.append(button);
  }
  container.append(controls);

  return { destroy() { alive = false; }, get view() { return { yaw, pitch, fov }; } };
}
