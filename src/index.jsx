import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// ✅ FIX: con skipWaiting+clientsClaim (ver vite.config.js), el Service
// Worker nuevo toma el control apenas se detecta — pero el código de React
// que ya está corriendo en la pestaña sigue siendo el viejo hasta que se
// recargue. Sin este aviso, una corrección recién desplegada podía quedar
// "a medias": el Service Worker nuevo activo, pero la app todavía mostrando
// el comportamiento anterior. Se recarga una sola vez (nunca en bucle) apenas
// el navegador avisa que ya hay un Service Worker nuevo al mando.
if ('serviceWorker' in navigator) {
  let yaRecargando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (yaRecargando) return;
    yaRecargando = true;
    window.location.reload();
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<React.StrictMode><App /></React.StrictMode>);
// Tue Jun  9 21:07:59 -04 2026
// cache bust Tue Jun  9 21:24:27 -04 2026
// reconnect Tue Jun  9 21:39:38 -04 2026
// trigger Wed Jun 10 12:26:36 -04 2026
