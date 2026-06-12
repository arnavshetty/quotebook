import { useState } from 'react'
import { Check, Pencil, X } from 'lucide-react'
import { getSpeakerBorderColor } from '../lib/speakerColors'

export default function SpeakerLeaderboard({
  entries,
  speakerColorMap,
  canRename,
  onRename,
  renaming,
  message,
  hideHeader = false,
  activeSpeaker = '',
  onSpeakerSelect,
}) {
  const [editingSpeaker, setEditingSpeaker] = useState(null)
  const [newName, setNewName] = useState('')

  if (!entries.length) return null

  const maxCount = entries[0]?.count || 1

  const startEdit = (speaker, event) => {
    event.stopPropagation()
    setEditingSpeaker(speaker)
    setNewName(speaker)
  }

  const cancelEdit = (event) => {
    event?.stopPropagation()
    setEditingSpeaker(null)
    setNewName('')
  }

  const saveEdit = async (event) => {
    event?.stopPropagation()
    const trimmed = newName.trim()
    if (!trimmed || trimmed === editingSpeaker) {
      cancelEdit()
      return
    }

    if (!window.confirm(`Rename "${editingSpeaker}" to "${trimmed}" in all quotes?`)) return

    try {
      await onRename(editingSpeaker, trimmed)
      cancelEdit()
    } catch {
      // Parent handles errors.
    }
  }

  const handleSelect = (speaker) => {
    if (!onSpeakerSelect || editingSpeaker) return
    onSpeakerSelect(speaker)
  }

  return (
    <div className="speaker-leaderboard" aria-label="Quotes per speaker">
      {!hideHeader && (
        <div className="speaker-leaderboard-header">
          <h3>Speakers</h3>
          <p className="speaker-leaderboard-hint">
            {activeSpeaker && onSpeakerSelect
              ? `Showing quotes by ${activeSpeaker} — click again to clear`
              : onSpeakerSelect
                ? 'Ranked by quote count · click to filter'
                : 'Ranked by quote count'}
          </p>
        </div>
      )}

      <ol className="speaker-leaderboard-list">
        {entries.map(({ speaker, count }, index) => {
          const color = getSpeakerBorderColor(speaker, speakerColorMap)
          const itemStyle = { '--speaker-color': color }
          const isActive = activeSpeaker === speaker
          const isClickable = Boolean(onSpeakerSelect) && editingSpeaker !== speaker

          return (
            <li
              key={speaker}
              className={[
                'speaker-leaderboard-item',
                isActive ? 'speaker-leaderboard-item--active' : '',
                isClickable ? 'speaker-leaderboard-item--clickable' : '',
              ].filter(Boolean).join(' ')}
              style={itemStyle}
              onClick={isClickable ? () => handleSelect(speaker) : undefined}
              onKeyDown={isClickable ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  handleSelect(speaker)
                }
              } : undefined}
              role={isClickable ? 'button' : undefined}
              tabIndex={isClickable ? 0 : undefined}
              aria-pressed={isClickable ? isActive : undefined}
            >
              {editingSpeaker === speaker ? (
                <div
                  className="speaker-leaderboard-edit"
                  onClick={(event) => event.stopPropagation()}
                >
                  <input
                    type="text"
                    className="speaker-leaderboard-input"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    aria-label={`Rename ${speaker}`}
                    autoFocus
                    disabled={renaming}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit(e)
                      if (e.key === 'Escape') cancelEdit(e)
                    }}
                  />
                  <div className="speaker-leaderboard-edit-actions">
                    <button
                      type="button"
                      className="icon-action-btn icon-action-btn--confirm"
                      onClick={saveEdit}
                      disabled={renaming || !newName.trim()}
                      aria-label="Save speaker name"
                    >
                      <Check size={14} strokeWidth={2} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="icon-action-btn icon-action-btn--discard"
                      onClick={cancelEdit}
                      disabled={renaming}
                      aria-label="Cancel rename"
                    >
                      <X size={14} strokeWidth={2} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="speaker-leaderboard-row">
                    <span className="speaker-leaderboard-rank">{index + 1}</span>
                    <div className="speaker-leaderboard-name-wrap">
                      <span className="speaker-leaderboard-name" title={speaker}>{speaker}</span>
                      {canRename && (
                        <button
                          type="button"
                          className="icon-action-btn icon-action-btn--compact icon-action-btn--reveal"
                          onClick={(event) => startEdit(speaker, event)}
                          aria-label={`Rename ${speaker}`}
                        >
                          <Pencil size={11} strokeWidth={2} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                    <span className="speaker-leaderboard-count">{count}</span>
                  </div>
                  <div className="speaker-leaderboard-bar-wrap" aria-hidden="true">
                    <span
                      className="speaker-leaderboard-bar"
                      style={{ width: `${(count / maxCount) * 100}%` }}
                    />
                  </div>
                </>
              )}
            </li>
          )
        })}
      </ol>

      {message && <p className="success sidebar-feedback">{message}</p>}
    </div>
  )
}
