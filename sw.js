self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === "navigate" || ["script", "style", "manifest"].includes(request.destination)) {
    event.respondWith(fetch(request, { cache: "no-store" }));
  }
});
