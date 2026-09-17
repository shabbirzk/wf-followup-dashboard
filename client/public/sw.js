self.addEventListener('push', (event) => {
  let data = {};

  try {
    data = event.data
      ? event.data.json()
      : {};
  } catch (error) {
    data = {
      title: 'Follow-up Reminder',
      body: event.data
        ? event.data.text()
        : 'A follow-up is due.'
    };
  }

  const title =
    data.title ||
    'Follow-up Reminder';

  const options = {
    body:
      data.body ||
      'A follow-up is due.',

    icon: '/favicon.ico',

    badge: '/favicon.ico',

    data: {
      url:
        data.url ||
        `/?tab=followups&followupId=${encodeURIComponent(
          data.followupId || ''
        )}`
    },

    requireInteraction: true
  };

  event.waitUntil(
    self.registration.showNotification(
      title,
      options
    )
  );
});

self.addEventListener(
  'notificationclick',
  (event) => {
    event.notification.close();

    const targetUrl =
      event.notification?.data?.url ||
      '/?tab=followups';

    event.waitUntil(
      clients
        .matchAll({
          type: 'window',
          includeUncontrolled: true
        })
        .then((clientList) => {
          for (
            const client of clientList
          ) {
            if ('focus' in client) {
              client.navigate(
                targetUrl
              );

              return client.focus();
            }
          }

          if (clients.openWindow) {
            return clients.openWindow(
              targetUrl
            );
          }

          return undefined;
        })
    );
  }
);