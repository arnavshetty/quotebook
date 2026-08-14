import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { api, supabase } from '../api/client'

function formatRelativeTime(iso) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`

  return new Date(iso).toLocaleDateString()
}

export default function NotificationBell({ userId }) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const panelRef = useRef(null)
  const buttonRef = useRef(null)

  const refresh = useCallback(async () => {
    if (!userId) return

    const [{ notifications: items }, { count }] = await Promise.all([
      api.getNotifications(),
      api.getUnreadNotificationCount(),
    ])

    setNotifications(items)
    setUnreadCount(count)
  }, [userId])

  useEffect(() => {
    if (!userId) return undefined

    setLoading(true)
    refresh()
      .catch(() => {
        setNotifications([])
        setUnreadCount(0)
      })
      .finally(() => setLoading(false))

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
          refresh().catch(() => {})
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, refresh])

  useEffect(() => {
    if (!open) return undefined

    const handlePointerDown = (event) => {
      const target = event.target
      if (panelRef.current?.contains(target)) return
      if (buttonRef.current?.contains(target)) return
      setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  const handleToggle = () => {
    setOpen((prev) => !prev)
  }

  const handleNotificationClick = async (notification) => {
    if (!notification.read_at) {
      try {
        await api.markNotificationRead(notification.id)
        await refresh()
      } catch {
        // Still navigate if marking read fails.
      }
    }

    setOpen(false)
  }

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead()
      await refresh()
    } catch {
      // Ignore for now; list stays as-is.
    }
  }

  if (!userId) return null

  return (
    <div className="notification-bell">
      <button
        ref={buttonRef}
        type="button"
        className={`notification-bell-btn${open ? ' is-open' : ''}`}
        onClick={handleToggle}
        aria-label={unreadCount ? `${unreadCount} unread notifications` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell size={18} strokeWidth={2} aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="notification-bell-badge" aria-hidden="true">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div ref={panelRef} className="notification-panel" role="dialog" aria-label="Notifications">
          <div className="notification-panel-header">
            <h2>Notifications</h2>
            {unreadCount > 0 && (
              <button type="button" className="notification-mark-all" onClick={handleMarkAllRead}>
                Mark all read
              </button>
            )}
          </div>

          {loading ? (
            <p className="notification-panel-empty">Loading…</p>
          ) : notifications.length === 0 ? (
            <p className="notification-panel-empty">No notifications yet.</p>
          ) : (
            <ul className="notification-list">
              {notifications.map((notification) => {
                const isUnread = !notification.read_at

                return (
                  <li key={notification.id}>
                    <Link
                      to={`/quotebook/${notification.quotebook_id}`}
                      className={`notification-item${isUnread ? ' notification-item--unread' : ''}`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <span className="notification-item-title">
                        {notification.actor_name}
                        {' added a quote to '}
                        <strong>{notification.quotebook_title}</strong>
                      </span>
                      <span className="notification-item-preview">“{notification.preview_text}”</span>
                      <span className="notification-item-time">
                        {formatRelativeTime(notification.created_at)}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
