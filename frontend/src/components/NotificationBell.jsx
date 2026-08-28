import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import useMediaQuery from '../hooks/useMediaQuery'
import useNotifications from '../hooks/useNotifications'
import NotificationList from './NotificationList'

const MOBILE_NOTIFICATIONS_QUERY = '(max-width: 900px)'

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

function NotificationBadge({ unreadCount }) {
  if (unreadCount <= 0) return null

  return (
    <span className="notification-bell-badge" aria-hidden="true">
      {unreadCount > 99 ? '99+' : unreadCount}
    </span>
  )
}

export default function NotificationBell({ user }) {
  const [open, setOpen] = useState(false)
  const isMobile = useMediaQuery(MOBILE_NOTIFICATIONS_QUERY)
  const location = useLocation()
  const panelRef = useRef(null)
  const buttonRef = useRef(null)

  const {
    notifications,
    unreadCount,
    loading,
    error,
    setError,
    markNotificationRead,
    markAllRead,
  } = useNotifications(user)

  const isNotificationsPage = location.pathname === '/notifications'
  const ariaLabel = unreadCount ? `${unreadCount} unread notifications` : 'Notifications'

  useEffect(() => {
    if (!open || isMobile) return undefined

    const handlePointerDown = (event) => {
      const target = event.target
      if (panelRef.current?.contains(target)) return
      if (buttonRef.current?.contains(target)) return
      setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open, isMobile])

  const handleToggle = () => {
    setError('')
    setOpen((prev) => !prev)
  }

  const handleNotificationClick = async (notification) => {
    await markNotificationRead(notification)
    setOpen(false)
  }

  if (!user) return null

  if (isMobile) {
    return (
      <div className="notification-bell">
        <Link
          to="/notifications"
          state={{ from: `${location.pathname}${location.search}` }}
          className={`notification-bell-btn${isNotificationsPage ? ' is-open' : ''}`}
          aria-label={ariaLabel}
          aria-current={isNotificationsPage ? 'page' : undefined}
        >
          <BellIcon />
          <NotificationBadge unreadCount={unreadCount} />
        </Link>
      </div>
    )
  }

  return (
    <div className="notification-bell">
      <button
        ref={buttonRef}
        type="button"
        className={`notification-bell-btn${open ? ' is-open' : ''}`}
        onClick={handleToggle}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <BellIcon />
        <NotificationBadge unreadCount={unreadCount} />
      </button>

      {open && (
        <div ref={panelRef} className="notification-panel" role="dialog" aria-label="Notifications">
          <NotificationList
            notifications={notifications}
            loading={loading}
            error={error}
            unreadCount={unreadCount}
            onMarkAllRead={markAllRead}
            onNotificationClick={handleNotificationClick}
          />
        </div>
      )}
    </div>
  )
}
