import { useEffect, useRef, useState } from 'react'
import { Check, Pencil, X } from 'lucide-react'
import { api } from '../api/client'

export default function QuotebookHeader({
  quotebookId,
  quotebook,
  canEdit,
  onUpdate,
}) {
  const titleInputRef = useRef(null)
  const [editing, setEditing] = useState(false)
  const [showActions, setShowActions] = useState(false)
  const [title, setTitle] = useState(quotebook?.title || '')
  const [description, setDescription] = useState(quotebook?.description || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!editing) {
      setTitle(quotebook?.title || '')
      setDescription(quotebook?.description || '')
    }
  }, [quotebook?.title, quotebook?.description, editing])

  useEffect(() => {
    if (!editing) {
      setShowActions(false)
      return undefined
    }

    const timer = window.setTimeout(() => {
      setShowActions(true)
      titleInputRef.current?.focus()
      titleInputRef.current?.select()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [editing])

  const stopEditing = () => {
    setEditing(false)
    setShowActions(false)
  }

  const handleCancel = () => {
    setTitle(quotebook?.title || '')
    setDescription(quotebook?.description || '')
    setError('')
    stopEditing()
  }

  const handleSave = async (event) => {
    event.preventDefault()
    if (!showActions || saving) return

    setSaving(true)
    setError('')
    try {
      const data = await api.updateQuotebook(quotebookId, { title, description })
      onUpdate(data.quotebook)
      stopEditing()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const startEditing = () => {
    setError('')
    setEditing(true)
  }

  return (
    <header className="page-header">
      <form className="quotebook-header-inline" onSubmit={handleSave}>
        <h2 className="page-header-title">
          {editing ? (
            <input
              ref={titleInputRef}
              id="quotebook-title"
              type="text"
              className="inline-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-label="Title"
              required
            />
          ) : (
            <span>{quotebook?.title || `Quotebook #${quotebookId}`}</span>
          )}
          {canEdit && (
            <div className="inline-header-actions">
              {editing && showActions ? (
                <>
                  <button
                    type="submit"
                    className="icon-action-btn icon-action-btn--confirm"
                    disabled={saving}
                    aria-label="Save changes"
                  >
                    <Check size={15} strokeWidth={2} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="icon-action-btn icon-action-btn--discard"
                    onClick={handleCancel}
                    disabled={saving}
                    aria-label="Discard changes"
                  >
                    <X size={15} strokeWidth={2} aria-hidden="true" />
                  </button>
                </>
              ) : editing ? (
                <span className="inline-header-actions-spacer" aria-hidden="true" />
              ) : (
                <button
                  type="button"
                  className="icon-action-btn"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={startEditing}
                  aria-label="Edit title and description"
                >
                  <Pencil size={15} strokeWidth={2} aria-hidden="true" />
                </button>
              )}
            </div>
          )}
        </h2>

        {(quotebook?.description || editing) && (
          editing ? (
            <input
              id="quotebook-description"
              type="text"
              className="inline-subtitle-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              aria-label="Description"
              placeholder="Add a description…"
            />
          ) : (
            <p className="page-subtitle">{quotebook.description}</p>
          )
        )}

        {error && <p className="error inline-edit-error">{error}</p>}
      </form>
    </header>
  )
}
