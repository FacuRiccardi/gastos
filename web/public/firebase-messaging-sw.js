// Shows the cap alerts sent by the backend. FCM delivers data-only messages: the fields arrive
// under `data` (title, body, url). No Firebase libraries are needed here.
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data?.json()?.data ?? {}
  } catch {
    return
  }
  if (!data.title) return
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon.svg',
      data: { url: data.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => client.url.startsWith(self.location.origin))
      if (open) return open.focus().then((client) => (client && 'navigate' in client ? client.navigate(url) : client))
      return self.clients.openWindow(url)
    }),
  )
})
