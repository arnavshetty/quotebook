import { Link } from 'react-router-dom'
import Logo from './Logo'
import NotificationBell from './NotificationBell'

export default function Header({ user, onLogout }) {
  return (
    <header className="header">
      <Link to="/" className="brand">
        <Logo size={32} />
        <span className="brand-name">Quotebook</span>
      </Link>
      <nav>
        {user ? (
          <>
            <NotificationBell userId={user.id} />
            <span className="nav-user">{user.username}</span>
            <button type="button" className="nav-btn" onClick={onLogout}>
              Log out
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="nav-link">Log in</Link>
            <Link to="/signup" className="nav-link">Sign up</Link>
          </>
        )}
      </nav>
    </header>
  )
}
