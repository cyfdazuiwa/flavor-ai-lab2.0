// Service Worker - 缓存静态资源，实现二次访问秒开
const CACHE_NAME = 'flavor-ai-lab-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/assets/index-D_HQT8R9.js',
  '/assets/index-DoybfhkN.css',
  '/override-screenshot.js'
];

// 安装时缓存核心资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// 激活时清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// 拦截请求，优先从缓存读取
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // 只缓存同源请求和 CDN 资源
  if (url.origin !== self.location.origin && !url.host.includes('cdn.jsdelivr.net')) {
    return;
  }
  
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // 缓存命中，直接返回
      if (cachedResponse) {
        // 后台更新缓存（Stale-While-Revalidate 策略）
        fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, networkResponse.clone());
            });
          }
        }).catch(() => {});
        return cachedResponse;
      }
      
      // 缓存未命中，从网络获取
      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }
        
        // 缓存新资源
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });
        
        return networkResponse;
      });
    })
  );
});
