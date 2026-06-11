import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'

export default function Dashboard() {
  const [quotebooks, setQuotebooks] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)

  const loadQuotebooks = () =>
    api.getQuotebooks()
      .then((data) => setQuotebooks(data.quotebooks))
      .catch((err) => setError(err.message))

  useEffect(() => {
    loadQuotebooks().finally(() => setLoading(false))
  }, [])

  const handleCreate = async (event) => {
    event.preventDefault()
    setError('')
    setCreating(true)

    try {
      await api.createQuotebook({ title, description })
      setTitle('')
      setDescription('')
      await loadQuotebooks()
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (book) => {
    if (book.user_role !== 'owner') return
    if (!window.confirm(`Delete "${book.title}"? All quotes inside will be removed.`)) return

    setError('')
    try {
      await api.deleteQuotebook(book.id)
      setQuotebooks((prev) => prev.filter((b) => b.id !== book.id))
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return <p className="page-message">Loading quotebooks...</p>

  return (
    <div className="dashboard">
      <h2>Your quotebooks</h2>
      {error && <p className="error">{error}</p>}

      <section className="create-quotebook-panel">
        <h3>Create a quotebook</h3>
        <form className="create-quotebook-form" onSubmit={handleCreate}>
          <input
            type="text"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <button type="submit" disabled={creating}>
            {creating ? 'Creating...' : 'Create quotebook'}
          </button>
        </form>
      </section>

      {quotebooks.length === 0 ? (
        <p className="page-message">No quotebooks yet. Create one above to get started.</p>
      ) : (
        <div className="quotebooks-list">
          {quotebooks.map((book) => (
            <article key={book.id} className="quotebook-card">
              {book.user_role === 'owner' && (
                <button
                  type="button"
                  className="delete-btn"
                  onClick={() => handleDelete(book)}
                  aria-label={`Delete ${book.title}`}
                >
                  &times;
                </button>
              )}
              <h3>
                <Link to={`/quotebook/${book.id}`}>{book.title}</Link>
              </h3>
              <p>{book.description}</p>
              <span className="badge">Role: {book.user_role}</span>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
