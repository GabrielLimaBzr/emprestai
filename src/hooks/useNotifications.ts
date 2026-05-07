'use client'

import { useEffect, useState, useCallback } from 'react'
import { saveSubscription, deleteSubscription } from '@/app/actions/notifications'

export function useNotifications() {
  const [suportado, setSuportado] = useState(false)
  const [permissao, setPermissao] = useState<NotificationPermission>('default')
  const [inscrito, setInscrito] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const ok = typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window
    setSuportado(ok)
    if (ok) setPermissao(Notification.permission)
  }, [])

  useEffect(() => {
    if (!suportado) return
    navigator.serviceWorker.register('/sw.js').then(async (reg) => {
      const sub = await reg.pushManager.getSubscription()
      setInscrito(!!sub)
    })
  }, [suportado])

  const inscrever = useCallback(async () => {
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      let perm = Notification.permission
      if (perm === 'default') {
        perm = await Notification.requestPermission()
        setPermissao(perm)
      }
      if (perm !== 'granted') return

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // A spec permite string base64url diretamente como applicationServerKey
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      })

      await saveSubscription(sub.toJSON() as PushSubscriptionJSON)
      setInscrito(true)
    } finally {
      setLoading(false)
    }
  }, [])

  const cancelarInscricao = useCallback(async () => {
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await sub.unsubscribe()
        await deleteSubscription(sub.endpoint)
      }
      setInscrito(false)
    } finally {
      setLoading(false)
    }
  }, [])

  return { suportado, permissao, inscrito, loading, inscrever, cancelarInscricao }
}
