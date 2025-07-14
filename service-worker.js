self.addEventListener("install", event => {
  event.waitUntil(
    caches.open("aris-cache").then(cache => {
      return cache.addAll([
        "index.html",
        "aris.js",
        "manifest.json",
        "style.css",      // if exists
        "icon-192.png",
        "icon-512.png"
      ]);
    })
  );
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});