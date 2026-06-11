import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, supabase } from '../api/client'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [checking, setChecking] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let active = true

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return
      if (event === 'PASSWORD_RECOVERY' || session) {
        setReady(true)
      }
      setChecking(false)
    })

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      if (data.session || window.location.hash.includes('type=recovery')) {
        setReady(true)
      } else {
        setError('Open the reset link from your email to choose a new password.')
      }
      setChecking(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setSubmitting(true)
    try {
      await api.updatePassword(password)
      navigate('/login', {
        replace: true,
        state: { message: 'Password updated. Log in with your new password.' },
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (checking) {
    return (
      <div className="auth-page">
        <p className="page-message">Checking reset link…</p>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h2>Choose a new password</h2>
        {error && <p className="error">{error}</p>}
        {ready ? (
          <>
            <div className="form-group">
              <label htmlFor="password">New password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoFocus
              />
            </div>
            <div className="form-group">
              <label htmlFor="confirm-password">Confirm password</label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Update password'}
            </button>
          </>
        ) : (
          <p className="auth-switch">
            <Link to="/forgot-password">Request a new reset link</Link>
          </p>
        )}
        <p className="auth-switch">
          <Link to="/login">Back to log in</Link>
        </p>
      </form>
    </div>
  )
}
