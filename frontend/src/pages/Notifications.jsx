import { ArrowLeft } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import NotificationList from '../components/NotificationList'
import useNotifications from '../hooks/useNotifications'

function backTarget(location) {
  const from = location.state?.from
  if (typeof from === 'string' && from.startsWith('/') && from !== '/notifications') {
    return from
  }
  return '/'
}

export default function Notifications({ user }) {
  const location = useLocation()
  const {
    notifications,
    unreadCount,
    loading,
    error,
    markNotificationRead,
    markAllRead,
  } = useNotifications(user)

  return (
    <div className="notifications-page">
      <header className="notifications-page-header">
        <Link to={backTarget(location)} className="notifications-back">
          <ArrowLeft size={20} strokeWidth={2.25} aria-hidden="true" />
          <span>Back</span>
        </Link>
        <h1>Notifications</h1>
      </header>

      <div className="notifications-page-content">
        <NotificationList
          notifications={notifications ?? []}
          loading={loading}
          error={error}
          unreadCount={unreadCount}
          onMarkAllRead={markAllRead}
          onNotificationClick={markNotificationRead}
          variant="page"
        />
      </div>
    </div>
  )
}
