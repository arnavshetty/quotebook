import { useCallback, useEffect, useState } from 'react'
import { api, supabase } from '../api/client'

export default function useNotifications(user) {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState(user?.id ?? null)

  useEffect(() => {
    if (user?.id) {
      setUserId(user.id)
      return undefined
    }

    let active = true
    supabase.auth.getUser().then(({ data, error: authError }) => {
      if (!active || authError) return
      setUserId(data.user?.id ?? null)
    })

    return () => {
      active = false
    }
  }, [user?.id])

  const refresh = useCallback(async (isActive = () => true) => {
    if (!userId || !isActive()) return

    try {
      const [{ notifications: items }, { count }] = await Promise.all([
        api.getNotifications(),
        api.getUnreadNotificationCount(),
      ])

      if (!isActive()) return

      setNotifications(items)
      setUnreadCount(count)
    } catch {
      if (!isActive()) return
      setNotifications([])
      setUnreadCount(0)
    }
  }, [userId])

  useEffect(() => {
    if (!userId) return undefined

    let active = true
    const isActive = () => active

    setLoading(true)
    refresh(isActive).finally(() => {
      if (isActive()) setLoading(false)
    })

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          refresh(isActive)
        },
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [userId, refresh])

  const markNotificationRead = async (notification) => {
    if (notification.read_at) return

    try {
      await api.markNotificationRead(notification.id)
      setError('')
      await refresh()
    } catch (err) {
      setError(err.message || 'Could not mark notification as read.')
    }
  }

  const markAllRead = async () => {
    try {
      await api.markAllNotificationsRead()
      setError('')
      await refresh()
    } catch (err) {
      setError(err.message || 'Could not mark all notifications as read.')
    }
  }

  return {
    notifications,
    unreadCount,
    loading,
    error,
    setError,
    refresh,
    markNotificationRead,
    markAllRead,
  }
}
