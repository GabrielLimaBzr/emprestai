self.addEventListener('push', (event) => {
  if (!event.data) return
  const data = event.data.json()
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon.svg',
      data: { url: data.url ?? '/' },
      tag: data.tag ?? 'emprestai',
      renotify: true,
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const match = list.find((c) => c.url.includes(self.location.origin))
      if (match) {
        match.focus()
        return match.navigate(url)
      }
      return clients.openWindow(url)
    })
  )
})
