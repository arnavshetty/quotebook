import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import NotificationList from '../components/NotificationList'
import useNotifications from '../hooks/useNotifications'

export default function Notifications({ user }) {
  const navigate = useNavigate()
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
        <button
          type="button"
          className="notifications-back"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          <ArrowLeft size={20} strokeWidth={2.25} aria-hidden="true" />
          <span>Back</span>
        </button>
        <h1>Notifications</h1>
      </header>

      <div className="notifications-page-content">
        <NotificationList
          notifications={notifications}
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
