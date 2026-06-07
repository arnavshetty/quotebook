import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { api, supabase, toAppUser } from './api/client'
import Header from './components/Header'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Quotebook from './pages/Quotebook'
import Signup from './pages/Signup'
import './App.css'

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

    const loadSession = async () => {
      const { data, error } = await supabase.auth.getSession()
      if (!active) return

      if (error) {
        setUser(null)
      } else if (data.session?.user) {
        try {
          setUser(await toAppUser(data.session.user))
        } catch {
          setUser(null)
        }
      } else {
        setUser(null)
      }
      setLoading(false)
    }

    loadSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!active) return

      if (session?.user) {
        try {
          setUser(await toAppUser(session.user))
        } catch {
          setUser(null)
        }
      } else {
        setUser(null)
      }
      setLoading(false)
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
    return <div className="loading">Loading...</div>
  }

  return (
    <>
      <Header user={user} onLogout={handleLogout} />
      <main className="main">
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login onLogin={setUser} />} />
          <Route path="/signup" element={user ? <Navigate to="/" replace /> : <Signup onSignup={setUser} />} />
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
