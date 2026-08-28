import { Link } from 'react-router-dom'
import formatRelativeTime from '../lib/formatRelativeTime'

export default function NotificationList({
  notifications,
  loading,
  error,
  unreadCount,
  onMarkAllRead,
  onNotificationClick,
  variant = 'panel',
}) {
  const listClassName = variant === 'page' ? 'notification-list notification-list--page' : 'notification-list'

  return (
    <>
      {(variant === 'panel' || unreadCount > 0) && (
        <div className={`notification-panel-header${variant === 'page' ? ' notification-panel-header--page' : ''}`}>
          {variant === 'panel' && <h2>Notifications</h2>}
          {unreadCount > 0 && (
            <button type="button" className="notification-mark-all" onClick={onMarkAllRead}>
              Mark all read
            </button>
          )}
        </div>
      )}

      {error && <p className="error notification-panel-error">{error}</p>}

      {loading ? (
        <p className="notification-panel-empty">Loading…</p>
      ) : notifications.length === 0 ? (
        <p className="notification-panel-empty">No notifications yet.</p>
      ) : (
        <ul className={listClassName}>
          {notifications.map((notification) => {
            const isUnread = !notification.read_at

            return (
              <li key={notification.id}>
                <Link
                  to={`/quotebook/${notification.quotebook_id}`}
                  className={`notification-item${isUnread ? ' notification-item--unread' : ''}`}
                  onClick={() => onNotificationClick(notification)}
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
    </>
  )
}
