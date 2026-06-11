import { Link } from 'react-router-dom'

export default function Header({ user, onLogout }) {
  return (
    <header className="header">
      <h1>
        <Link to="/">Quotebook</Link>
      </h1>
      <nav>
        {user ? (
          <>
            <span className="nav-user">Hi, {user.username}</span>
            <button type="button" className="nav-btn" onClick={onLogout}>
              Log Out
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="nav-link">Log In</Link>
            <Link to="/signup" className="nav-link">Sign Up</Link>
          </>
        )}
      </nav>
    </header>
  )
}
