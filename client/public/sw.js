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

    requireInteraction: true,

    actions: [
      {
        action: 'snooze',
        title: 'Snooze 10 min'
      },
      {
        action: 'complete',
        title: 'Complete'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ],

    data: {
      url:
        data.url ||
        `/?tab=followups&followupId=${encodeURIComponent(
          data.followupId || ''
        )}`,

      apiUrl:
        data.apiUrl ||
        'https://wf-followup-api1.onrender.com/api',

      followupId:
        data.followupId || '',

      customerId:
        data.customerId || ''
    }
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
    const notification =
      event.notification;

    const action =
      event.action;

    const data =
      notification.data || {};

    const followupId =
      data.followupId;

    const apiUrl =
      data.apiUrl ||
      'https://wf-followup-api1.onrender.com/api';

    /*
     * Always close the notification
     * after the user takes an action.
     */
    notification.close();

    /*
     * DISMISS
     *
     * Only closes the notification.
     * Follow-up remains Pending.
     */
    if (action === 'dismiss') {
      return;
    }

    /*
     * SNOOZE
     */
    if (
      action === 'snooze'
    ) {
      event.waitUntil(
        fetch(
          `${apiUrl}/notifications/action`,
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json'
            },

            body: JSON.stringify({
              action:
                'snooze',

              followupId:
                followupId
            })
          }
        ).catch((error) => {
          console.error(
            'Snooze notification action failed:',
            error
          );
        })
      );

      return;
    }

    /*
     * COMPLETE
     */
    if (
      action === 'complete'
    ) {
      event.waitUntil(
        fetch(
          `${apiUrl}/notifications/action`,
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json'
            },

            body: JSON.stringify({
              action:
                'complete',

              followupId:
                followupId
            })
          }
        ).catch((error) => {
          console.error(
            'Complete notification action failed:',
            error
          );
        })
      );

      return;
    }

    /*
     * Normal notification click
     * opens the relevant follow-up.
     */
    const targetUrl =
      data.url ||
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
            if (
              'navigate' in client
            ) {
              client.navigate(
                targetUrl
              );

              return client.focus();
            }
          }

          if (
            clients.openWindow
          ) {
            return clients.openWindow(
              targetUrl
            );
          }

          return undefined;
        })
    );
  }
);
