import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api/client'
import QuoteCard from '../components/QuoteCard'
import QuoteForm from '../components/QuoteForm'

export default function Quotebook({ user }) {
  const { id } = useParams()
  const quotebookId = Number(id)

  const [quotebook, setQuotebook] = useState(null)
  const [quotes, setQuotes] = useState([])
  const [error, setError] = useState('')
  const [shareEmail, setShareEmail] = useState('')
  const [shareRole, setShareRole] = useState('viewer')
  const [shareMessage, setShareMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const loadQuotes = () =>
    api.getQuotes(quotebookId)
      .then((data) => setQuotes(data.quotes))
      .catch((err) => setError(err.message))

  useEffect(() => {
    Promise.all([
      api.getQuotebook(quotebookId).then((data) => setQuotebook(data.quotebook)),
      loadQuotes(),
    ])
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [quotebookId])

  const canWrite = quotebook && ['owner', 'contributor', 'admin'].includes(quotebook.user_role)
  const canShare = quotebook?.user_role === 'owner'

  const handleAddQuote = async (payload) => {
    setSubmitting(true)
    setError('')
    try {
      const data = await api.addQuote(quotebookId, payload)
      setQuotes(data.quotes)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (blockId) => {
    if (!window.confirm('Delete this quote?')) return
    setError('')
    try {
      await api.deleteQuote(blockId)
      setQuotes((prev) => prev.filter((q) => q.id !== blockId))
    } catch (err) {
      setError(err.message)
    }
  }

  const handleShare = async (event) => {
    event.preventDefault()
    setShareMessage('')
    setError('')
    try {
      const data = await api.shareQuotebook(quotebookId, {
        email: shareEmail,
        role: shareRole,
      })
      setShareMessage(data.message)
      setShareEmail('')
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return <p className="page-message">Loading quotebook...</p>

  return (
    <div className="quotebook-page">
      <h2>{quotebook?.title || `Quotebook #${quotebookId}`}</h2>
      {quotebook?.description && <p>{quotebook.description}</p>}
      {error && <p className="error">{error}</p>}
      {shareMessage && <p className="success">{shareMessage}</p>}

      {canShare && (
        <section className="share-panel">
          <h3>Share quotebook</h3>
          <form className="share-form" onSubmit={handleShare}>
            <input
              type="email"
              placeholder="friend@email.com"
              value={shareEmail}
              onChange={(e) => setShareEmail(e.target.value)}
              required
            />
            <select value={shareRole} onChange={(e) => setShareRole(e.target.value)}>
              <option value="viewer">Viewer</option>
              <option value="contributor">Contributor</option>
              <option value="admin">Admin</option>
            </select>
            <button type="submit">Share</button>
          </form>
          <p className="share-hint">
            Enter the email they used to sign up. The quotebook appears on their dashboard — no invite email is sent.
          </p>
        </section>
      )}

      {canWrite && <QuoteForm onSubmit={handleAddQuote} submitting={submitting} />}

      <section className="quotes-display">
        <h3>Quotes</h3>
        {quotes.length === 0 ? (
          <p className="page-message">No quotes yet. Add your first one above.</p>
        ) : (
          quotes.map((quote) => (
            <QuoteCard
              key={quote.id}
              quote={quote}
              canDelete={quote.user_id === user.id}
              onDelete={handleDelete}
            />
          ))
        )}
      </section>
    </div>
  )
}
