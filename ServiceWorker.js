const CACHE_NAME = "Sinestesia-Vipro-0.1.5-PWA";

// Lista completa de archivos para cachear (incluyendo archivos importantes que faltaban)
const contentToCache = [
    // Archivos esenciales
    "./",
    "./index.html",
    "./manifest.webmanifest",

    // Unity WebGL archivos compilados
    "./Build/Build PWA.loader.js",
    "./Build/Build PWA.framework.js",
    "./Build/Build PWA.data",
    "./Build/Build PWA.wasm",

    // Recursos de plantilla
    "./TemplateData/style.css",
    "./TemplateData/favicon.ico",
    "./TemplateData/unity-logo-dark.png",
    "./TemplateData/icons/unity-logo-dark.png",

    // Otros potenciales archivos (ajustar seg�n sea necesario)
    "./StreamingAssets/",
    "./ServiceWorker.js"
];

// Instalar: Cachear todos los recursos necesarios
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Instalando...');
    self.skipWaiting(); // Forzar activaci�n inmediata

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Cacheando archivos');
                return cache.addAll(contentToCache);
            })
            .catch(err => {
                console.error('[Service Worker] Error durante la instalaci�n:', err);
                // Intentar cachear archivos individualmente si falla el cacheo masivo
                return caches.open(CACHE_NAME).then(cache => {
                    return Promise.all(
                        contentToCache.map(url => {
                            return cache.add(url).catch(error => {
                                console.warn('[Service Worker] Error cacheando:', url, error);
                            });
                        })
                    );
                });
            })
    );
});

// Activar: Limpiar cach�s antiguas
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activando...');

    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    console.log('[Service Worker] Eliminando cach� antigua:', key);
                    return caches.delete(key);
                }
            }));
        })
    );
});

// Estrategia Fetch: Cach� primero, luego red (con actualizaci�n de cach�)
self.addEventListener('fetch', (event) => {
    // Ignorar solicitudes a otros dominios
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }

    // Estrategia para solicitudes GET (la mayor�a de los recursos)
    if (event.request.method === 'GET') {
        event.respondWith(
            caches.match(event.request)
                .then((cachedResponse) => {
                    // Devolver de cach� si existe
                    if (cachedResponse) {
                        console.log('[Service Worker] Recuperando de cach�:', event.request.url);

                        // Actualizar cach� en segundo plano (para la pr�xima visita)
                        fetch(event.request)
                            .then(response => {
                                if (response.ok) {
                                    caches.open(CACHE_NAME)
                                        .then(cache => cache.put(event.request, response));
                                }
                            })
                            .catch(() => console.log('[Service Worker] Red no disponible para actualizar cach�'));

                        return cachedResponse;
                    }

                    // Si no est� en cach�, intentar obtener de la red
                    console.log('[Service Worker] Cacheando nuevo recurso:', event.request.url);
                    return fetch(event.request)
                        .then((networkResponse) => {
                            // Si la respuesta es v�lida, a�adirla a la cach�
                            if (networkResponse && networkResponse.ok && networkResponse.type === 'basic') {
                                const responseToCache = networkResponse.clone();
                                caches.open(CACHE_NAME)
                                    .then((cache) => {
                                        cache.put(event.request, responseToCache);
                                    });
                            }
                            return networkResponse;
                        })
                        .catch(() => {
                            console.log('[Service Worker] Error de red y no en cach�:', event.request.url);
                            // Aqu� podr�as devolver una p�gina de fallback para ciertos tipos de recursos
                        });
                })
        );
    }
});

// Manejo especial para archivos grandes
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'CACHE_LARGE_FILE') {
        const url = event.data.url;
        console.log('[Service Worker] Solicitud para cachear archivo grande:', url);

        event.waitUntil(
            caches.open(CACHE_NAME)
                .then(cache => fetch(url)
                    .then(response => {
                        console.log('[Service Worker] Cacheando archivo grande:', url);
                        return cache.put(url, response);
                    })
                    .catch(err => console.error('[Service Worker] Error cacheando archivo grande:', err))
                )
        );
    }
});