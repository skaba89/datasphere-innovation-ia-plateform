/**
 * DataSphere Innovation — Service Worker v1.9.0
 *
 * Stratégies :
 *   - Assets statiques (JS/CSS/fonts) : Cache First (mise à jour en arrière-plan)
 *   - Pages HTML                       : Network First (avec fallback offline)
 *   - Requêtes API /api/v1             : Network Only (toujours frais)
 *   - Fichiers media                   : Stale While Revalidate
 *
 * Cache invalidation : à chaque nouvelle version du SW, les anciens caches
 * sont supprimés automatiquement.
 */

const SW_VERSION   = 'datasphere-v1.9.0';
const CACHE_STATIC = `${SW_VERSION}-static`;
const CACHE_PAGES  = `${SW_VERSION}-pages`;
const CACHE_MEDIA  = `${SW_VERSION}-media`;

// Assets critiques à précacher au moment de l'installation
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
];

// Page de fallback quand offline
const OFFLINE_PAGE = '/';

// ── Installation ──────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Activation — nettoyage des anciens caches ─────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key.startsWith('datasphere-') && !key.startsWith(SW_VERSION))
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch interception ────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ne pas intercepter les requêtes cross-origin non connues
  if (url.origin !== self.location.origin &&
      !url.hostname.endsWith('.cloudflare.com') &&
      !url.hostname.endsWith('.googleapis.com')) {
    return;
  }

  // API — Network Only (toujours frais, pas de cache)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Assets statiques (JS/CSS/images/fonts) — Cache First
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(event.request, CACHE_STATIC));
    return;
  }

  // Fichiers média (PNG/JPEG/etc.) — Stale While Revalidate
  if (isMediaFile(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event.request, CACHE_MEDIA));
    return;
  }

  // Pages HTML — Network First avec fallback offline
  if (event.request.mode === 'navigate' || url.pathname === '/') {
    event.respondWith(networkFirst(event.request, CACHE_PAGES));
    return;
  }
});

// ── Stratégies de cache ───────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Asset not available offline', { status: 503 });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request) || await caches.match(OFFLINE_PAGE);
    if (cached) return cached;
    return new Response(offlinePage(), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache   = await caches.open(cacheName);
  const cached  = await cache.match(request);
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || await fetchPromise;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isStaticAsset(pathname) {
  return /\.(js|css|woff2?|ttf|eot|ico|svg)$/i.test(pathname) ||
         pathname.startsWith('/assets/');
}

function isMediaFile(pathname) {
  return /\.(png|jpe?g|gif|webp|avif)$/i.test(pathname);
}

function offlinePage() {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>DataSphere — Hors connexion</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, sans-serif;
      background: #07111f;
      color: #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .card {
      text-align: center;
      max-width: 360px;
    }
    .logo { font-size: 1.4rem; font-weight: 900; color: #facc15; margin-bottom: 8px; }
    h1 { font-size: 1.2rem; margin-bottom: 12px; }
    p { color: #64748b; font-size: .9rem; line-height: 1.6; margin-bottom: 20px; }
    button {
      padding: 10px 22px;
      background: #facc15;
      color: #07111f;
      border: none;
      border-radius: 9px;
      font-weight: 800;
      cursor: pointer;
      font-size: .88rem;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">DataSphere</div>
    <h1>Vous êtes hors connexion</h1>
    <p>Reconnectez-vous à Internet pour accéder à la plateforme.</p>
    <button onclick="location.reload()">Réessayer</button>
  </div>
</body>
</html>`;
}

// ── Background sync (future) ──────────────────────────────────────────────────
// TODO: sync pending form submissions when back online
self.addEventListener('sync', (event) => {
  if (event.tag === 'datasphere-sync') {
    console.log('[SW] Background sync triggered');
  }
});
