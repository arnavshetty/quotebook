import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import InlineEditActions from './InlineEditActions'

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
              <InlineEditActions
                editing={editing}
                showEditPlaceholder={editing && !showActions}
                onEdit={startEditing}
                onCancel={handleCancel}
                saveType="submit"
                saving={saving}
                iconSize={15}
                editLabel="Edit title and description"
              />
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
