/* PrepIQ Web Push service worker — plain Web Push (VAPID), no Firebase.
 *
 * The backend sends a JSON payload of the shape:
 *   { title, body, data: { notification_id, category, ... } }
 */

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: 'PrepIQ', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'PrepIQ';
  const options = {
    body: payload.body || '',
    icon: '/logo/golden-main-transparent.png',
    badge: '/logo/dark-main-transparent.png',
    tag: (payload.data && payload.data.notification_id) || undefined,
    data: payload.data || {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Route taps to the notifications page, focusing an existing tab if open.
  const targetPath = '/workspace/notifications';
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes('/workspace') && 'focus' in client) {
            client.navigate(targetPath);
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetPath);
        }
        return undefined;
      }),
  );
});
