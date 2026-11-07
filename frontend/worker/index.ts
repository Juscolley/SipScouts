// Custom Service Worker logic for SipScouts Web Push Notifications
declare const self: ServiceWorkerGlobalScope

self.addEventListener('push', (event: any) => {
  let data: any = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : 'New SipScouts alert!' }
  }

  const title = data.title || 'SipScouts'
  const options = {
    body: data.body || 'New craft drink spots or secret happy hours just scouted!',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/discover',
    },
  }

  event.waitUntil((self as any).registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event: any) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/discover'

  event.waitUntil(
    (self as any).clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients: any[]) => {
      for (const client of windowClients) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus()
        }
      }
      if ((self as any).clients.openWindow) {
        return (self as any).clients.openWindow(targetUrl)
      }
    })
  )
})
