import { useEffect, useMemo, useState } from 'react'
import { LogOut, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { canLeaveQuotebook } from '../lib/quotePermissions'

function sortQuotebooks(books, sortBy) {
  const sorted = [...books]

  if (sortBy === 'quotes') {
    sorted.sort((a, b) => {
      const countDiff = Number(b.quote_count || 0) - Number(a.quote_count || 0)
      if (countDiff !== 0) return countDiff
      return a.title.localeCompare(b.title)
    })
  } else if (sortBy === 'title') {
    sorted.sort((a, b) => a.title.localeCompare(b.title))
  } else {
    sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }

  return sorted
}

function QuotebookCard({
  book,
  leaveTarget,
  deleteTarget,
  deleteConfirm,
  leaving,
  deleting,
  onLeaveClick,
  onDeleteClick,
  onCancelLeave,
  onCancelDelete,
  onDeleteConfirmChange,
  onLeave,
  onDelete,
}) {
  if (leaveTarget?.id === book.id) {
    return (
      <article className="quotebook-card">
        <div className="quotebook-delete-confirm quotebook-leave-confirm">
          <h3>Leave quotebook?</h3>
          <p className="quotebook-delete-warning">
            You will lose access to <strong>{book.title}</strong>. The owner can re-invite you later.
          </p>
          <div className="quote-form-actions">
            <button
              type="button"
              className="secondary-btn"
              onClick={onCancelLeave}
              disabled={leaving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="danger-btn"
              disabled={leaving}
              onClick={onLeave}
            >
              {leaving ? 'Leaving…' : 'Leave quotebook'}
            </button>
          </div>
        </div>
      </article>
    )
  }

  if (deleteTarget?.id === book.id) {
    return (
      <article className="quotebook-card">
        <div className="quotebook-delete-confirm">
          <h3>Delete quotebook?</h3>
          <p className="quotebook-delete-warning">
            This permanently removes <strong>{book.title}</strong> and all{' '}
            {Number(book.quote_count || 0)} quote{Number(book.quote_count || 0) === 1 ? '' : 's'} inside.
          </p>
          <div className="form-group">
            <label htmlFor={`delete-confirm-${book.id}`}>Type the title to confirm</label>
            <input
              id={`delete-confirm-${book.id}`}
              type="text"
              value={deleteConfirm}
              onChange={(e) => onDeleteConfirmChange(e.target.value)}
              placeholder={book.title}
              autoFocus
            />
          </div>
          <div className="quote-form-actions">
            <button
              type="button"
              className="secondary-btn"
              onClick={onCancelDelete}
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="danger-btn"
              disabled={deleteConfirm !== book.title || deleting}
              onClick={onDelete}
            >
              {deleting ? 'Deleting…' : 'Delete quotebook'}
            </button>
          </div>
        </div>
      </article>
    )
  }

  return (
    <article className="quotebook-card">
      <Link to={`/quotebook/${book.id}`} className="quotebook-card-link">
        <h3>{book.title}</h3>
        {book.description && <p>{book.description}</p>}
        <div className="quotebook-card-footer">
          <span className="quotebook-card-count">
            {Number(book.quote_count || 0)} quote{Number(book.quote_count || 0) === 1 ? '' : 's'}
          </span>
          <div className="quotebook-card-footer-end">
            <span className={`badge badge--${book.user_role}`}>{book.user_role}</span>
            {book.user_role === 'owner' ? (
              <button
                type="button"
                className="icon-action-btn icon-action-btn--discard quotebook-delete-trigger"
                onClick={(e) => onDeleteClick(e, book)}
                aria-label={`Delete ${book.title}`}
              >
                <Trash2 size={14} strokeWidth={2} aria-hidden="true" />
              </button>
            ) : canLeaveQuotebook(book) && (
              <button
                type="button"
                className="icon-action-btn quotebook-leave-trigger"
                onClick={(e) => onLeaveClick(e, book)}
                aria-label={`Leave ${book.title}`}
              >
                <LogOut size={14} strokeWidth={2} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </Link>
    </article>
  )
}

export default function Dashboard() {
  const [quotebooks, setQuotebooks] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [leaveTarget, setLeaveTarget] = useState(null)
  const [leaving, setLeaving] = useState(false)
  const [dashboardSort, setDashboardSort] = useState('recent')

  const loadQuotebooks = () =>
    api.getQuotebooks()
      .then((data) => setQuotebooks(data.quotebooks))
      .catch((err) => setError(err.message))

  useEffect(() => {
    loadQuotebooks().finally(() => setLoading(false))
  }, [])

  const { ownedBooks, sharedBooks } = useMemo(() => {
    const owned = quotebooks.filter((book) => book.user_role === 'owner')
    const shared = quotebooks.filter((book) => book.user_role !== 'owner')
    return {
      ownedBooks: sortQuotebooks(owned, dashboardSort),
      sharedBooks: sortQuotebooks(shared, dashboardSort),
    }
  }, [quotebooks, dashboardSort])

  const handleCreate = async (event) => {
    event.preventDefault()
    setError('')
    setCreating(true)

    try {
      const data = await api.createQuotebook({ title, description })
      setQuotebooks(data.quotebooks)
      setTitle('')
      setDescription('')
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  const cancelDelete = () => {
    setDeleteTarget(null)
    setDeleteConfirm('')
  }

  const cancelLeave = () => {
    setLeaveTarget(null)
  }

  const handleLeaveClick = (event, book) => {
    event.preventDefault()
    event.stopPropagation()
    setLeaveTarget(book)
    setDeleteTarget(null)
    setDeleteConfirm('')
  }

  const handleDeleteClick = (event, book) => {
    event.preventDefault()
    event.stopPropagation()
    setDeleteTarget(book)
    setDeleteConfirm('')
    setLeaveTarget(null)
  }

  const handleLeave = async () => {
    if (!leaveTarget) return

    setLeaving(true)
    setError('')
    try {
      await api.leaveQuotebook(leaveTarget.id)
      setQuotebooks((prev) => prev.filter((b) => b.id !== leaveTarget.id))
      cancelLeave()
    } catch (err) {
      setError(err.message)
    } finally {
      setLeaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget || deleteConfirm !== deleteTarget.title) return

    setDeleting(true)
    setError('')
    try {
      await api.deleteQuotebook(deleteTarget.id)
      setQuotebooks((prev) => prev.filter((b) => b.id !== deleteTarget.id))
      cancelDelete()
    } catch (err) {
      setError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  const cardProps = {
    leaveTarget,
    deleteTarget,
    deleteConfirm,
    leaving,
    deleting,
    onLeaveClick: handleLeaveClick,
    onDeleteClick: handleDeleteClick,
    onCancelLeave: cancelLeave,
    onCancelDelete: cancelDelete,
    onDeleteConfirmChange: setDeleteConfirm,
    onLeave: handleLeave,
    onDelete: handleDelete,
  }

  if (loading) return <p className="page-message">Loading quotebooks…</p>

  const showOwned = ownedBooks.length > 0
  const showShared = sharedBooks.length > 0

  return (
    <div className="dashboard">
      <header className="page-header dashboard-header">
        <div className="dashboard-header-main">
          <h2>Your quotebooks</h2>
          <p className="page-subtitle">Collect and share the lines worth keeping.</p>
        </div>

        {quotebooks.length > 0 && (
          <div className="dashboard-sort" role="group" aria-label="Sort quotebooks">
            <span className="dashboard-sort-label">Sort by</span>
            <div className="dashboard-sort-toggle">
              <button
                type="button"
                className={dashboardSort === 'recent' ? 'is-active' : ''}
                onClick={() => setDashboardSort('recent')}
              >
                Recent
              </button>
              <button
                type="button"
                className={dashboardSort === 'quotes' ? 'is-active' : ''}
                onClick={() => setDashboardSort('quotes')}
              >
                Most quotes
              </button>
              <button
                type="button"
                className={dashboardSort === 'title' ? 'is-active' : ''}
                onClick={() => setDashboardSort('title')}
              >
                Title
              </button>
            </div>
          </div>
        )}
      </header>

      {error && <p className="error">{error}</p>}

      <section className="panel create-quotebook-panel">
        <h3>New quotebook</h3>
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
            {creating ? 'Creating…' : 'Create'}
          </button>
        </form>
      </section>

      {quotebooks.length === 0 ? (
        <div className="empty-state">
          <strong>No quotebooks yet</strong>
          Create one above to start logging quotes and conversations.
        </div>
      ) : (
        <div className="dashboard-sections">
          {showOwned && (
            <section className="dashboard-section">
              <h3 className="dashboard-section-title">Yours</h3>
              <div className="quotebooks-list">
                {ownedBooks.map((book) => (
                  <QuotebookCard key={book.id} book={book} {...cardProps} />
                ))}
              </div>
            </section>
          )}

          {showShared && (
            <section className="dashboard-section">
              <h3 className="dashboard-section-title">Shared with you</h3>
              <div className="quotebooks-list">
                {sharedBooks.map((book) => (
                  <QuotebookCard key={book.id} book={book} {...cardProps} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
