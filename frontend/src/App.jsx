import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { api, supabase, toAppUser, usernameFromAuthUser } from './api/client'
import Header from './components/Header'
import Dashboard from './pages/Dashboard'
import ForgotPassword from './pages/ForgotPassword'
import Login from './pages/Login'
import Quotebook from './pages/Quotebook'
import ResetPassword from './pages/ResetPassword'
import Signup from './pages/Signup'
import './styles/index.css'

function ProtectedRoute({ user, children }) {
  if (!user) {
    return <Navigate to="/login" replace />
  }
  return children
}

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    // Keep auth notify handlers sync. Awaiting supabase.from()/getSession()
    // inside onAuthStateChange can deadlock with auth client init and leave
    // the app stuck on "Loading…" until a full refresh.
    const applyAuthUser = (authUser) => {
      if (!active) return

      if (!authUser) {
        setUser(null)
        setLoading(false)
        return
      }

      setUser({
        id: authUser.id,
        email: authUser.email,
        username: usernameFromAuthUser(authUser),
      })
      setLoading(false)

      toAppUser(authUser).then((appUser) => {
        if (active) setUser(appUser)
      })
    }

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          setUser(null)
          setLoading(false)
          return
        }
        applyAuthUser(data.session?.user ?? null)
      })
      .catch(() => {
        if (!active) return
        setUser(null)
        setLoading(false)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applyAuthUser(session?.user ?? null)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const handleLogout = async () => {
    await api.logout()
    setUser(null)
  }

  if (loading) {
    return <p className="loading">Loading…</p>
  }

  return (
    <>
      <Header user={user} onLogout={handleLogout} />
      <main className="main">
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login onLogin={setUser} />} />
          <Route path="/signup" element={user ? <Navigate to="/" replace /> : <Signup onSignup={setUser} />} />
          <Route path="/forgot-password" element={user ? <Navigate to="/" replace /> : <ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            path="/"
            element={
              <ProtectedRoute user={user}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/quotebook/:id"
            element={
              <ProtectedRoute user={user}>
                <Quotebook user={user} />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
    </>
  )
}
