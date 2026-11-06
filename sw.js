// New-hymn alerts: lets OneSignal show notifications even when the app is closed
try { importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js'); } catch (e) {}

const CACHE = 'mezmur-app-v8';
const ROOT = new URL('./', self.registration.scope).href;
const SHELL = ['./', 'index.html', 'app.js', 'data.js', 'config.js', 'manifest.json', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-180.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(p => new URL(p, ROOT).href))));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  // Own files only. YouTube videos and thumbnails go straight to the network.
  if (req.method !== 'GET' || url.origin !== location.origin) return;

  // The daily video list: always try the network first so new hymns show up
  if (url.pathname.endsWith('/videos.json')) {
    e.respondWith(fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; }).catch(() => caches.match(req)));
    return;
  }

  // Pictures never change under the same name: use the saved copy and skip the extra download
  if (/\/(s|b|icons)\//.test(url.pathname)) {
    e.respondWith(caches.match(req).then(c => c || fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(x => x.put(req, copy)); } return res; })));
    return;
  }

  const key = req.mode === 'navigate' ? ROOT : req;
  e.respondWith(
    caches.match(key).then(cached => {
      const fresh = fetch(req).then(res => {
        if (res.ok && res.status === 200) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(key, copy)); }
        return res;
      }).catch(() => cached);
      return cached || fresh;
    })
  );
});
