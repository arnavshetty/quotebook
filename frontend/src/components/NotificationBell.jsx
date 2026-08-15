import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
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

function BellIcon() {
  return (
    <svg
      className="notification-bell-icon"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10.268 21a2 2 0 0 0 3.464 0" />
      <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
    </svg>
  )
}

export default function NotificationBell({ user }) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState(user?.id ?? null)
  const panelRef = useRef(null)
  const buttonRef = useRef(null)

  useEffect(() => {
    if (user?.id) {
      setUserId(user.id)
      return undefined
    }

    let active = true
    supabase.auth.getUser().then(({ data, error }) => {
      if (!active || error) return
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

  if (!user) return null

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
        <BellIcon />
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
