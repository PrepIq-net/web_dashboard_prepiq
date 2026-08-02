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

  // Hand the notification id to the app rather than resolving a destination
  // here: the code -> route table lives in lib/notifications/destinations.ts,
  // and a second copy in this worker would drift the first time a route moved.
  // The notifications page forwards from ?n=<id>, so an unresolvable alert
  // simply lands on the feed — the old behaviour, as the fallback.
  const notificationId =
    event.notification.data && event.notification.data.notification_id;
  const targetPath = notificationId
    ? `/workspace/notifications?n=${encodeURIComponent(notificationId)}`
    : '/workspace/notifications';
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
