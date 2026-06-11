import { useEffect, useState } from 'react'
import { ChevronDown, LogOut } from 'lucide-react'
import { api } from '../api/client'
import SpeakerLeaderboard from './SpeakerLeaderboard'

const ROLES = ['viewer', 'contributor', 'admin']

export default function QuotebookSidebar({
  quotebookId,
  showCollaborators,
  speakerLeaderboard,
  speakerColorMap,
  canRename,
  onRename,
  renamingSpeaker,
  renameMessage,
  activeSpeaker,
  onSpeakerSelect,
  userRole,
  canLeave,
  onLeave,
  leaving,
}) {
  const [collaborators, setCollaborators] = useState([])
  const [shareEmail, setShareEmail] = useState('')
  const [shareRole, setShareRole] = useState('viewer')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loadingCollaborators, setLoadingCollaborators] = useState(showCollaborators)
  const [sharing, setSharing] = useState(false)
  const [speakersOpen, setSpeakersOpen] = useState(true)
  const [collaboratorsOpen, setCollaboratorsOpen] = useState(true)
  const [accessOpen, setAccessOpen] = useState(true)

  const showAccess = canLeave && userRole && userRole !== 'owner'

  const loadCollaborators = () =>
    api.getCollaborators(quotebookId)
      .then((data) => setCollaborators(data.collaborators))
      .catch((err) => setError(err.message))

  useEffect(() => {
    if (!showCollaborators) return undefined

    loadCollaborators().finally(() => setLoadingCollaborators(false))
  }, [quotebookId, showCollaborators])

  const handleShare = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')
    setSharing(true)
    try {
      const email = shareEmail.trim()
      const result = await api.shareQuotebook(quotebookId, { email, role: shareRole })
      setShareEmail('')
      await loadCollaborators()
      setMessage(result.message || `Shared with ${email}.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSharing(false)
    }
  }

  const handleRoleChange = async (userId, role) => {
    setError('')
    setMessage('')
    try {
      await api.updateCollaboratorRole(quotebookId, userId, role)
      setCollaborators((prev) =>
        prev.map((c) => (c.user_id === userId ? { ...c, role } : c)),
      )
      setMessage('Role updated.')
    } catch (err) {
      setError(err.message)
    }
  }

  const handleRemove = async (collaborator) => {
    const label = collaborator.username || collaborator.email
    if (!window.confirm(`Remove ${label} from this quotebook?`)) return
    setError('')
    setMessage('')
    try {
      await api.removeCollaborator(quotebookId, collaborator.user_id)
      setCollaborators((prev) => prev.filter((c) => c.user_id !== collaborator.user_id))
      setMessage('Collaborator removed.')
    } catch (err) {
      setError(err.message)
    }
  }

  const showSpeakers = speakerLeaderboard.length > 0

  return (
    <aside className="quotebook-sidebar">
      {showSpeakers && (
        <section
          className={`sidebar-section sidebar-section--collapsible${speakersOpen ? '' : ' is-collapsed'}`}
        >
          <button
            type="button"
            className="sidebar-section-toggle"
            onClick={() => setSpeakersOpen((open) => !open)}
            aria-expanded={speakersOpen}
          >
            <span className="sidebar-section-toggle-text">
              <span className="sidebar-section-toggle-title">Speakers</span>
              <span className="sidebar-section-toggle-hint">
                {activeSpeaker && onSpeakerSelect
                  ? `Filtering · ${activeSpeaker}`
                  : onSpeakerSelect
                    ? 'Ranked by count · click to filter'
                    : 'Ranked by count'}
              </span>
            </span>
            <ChevronDown size={16} strokeWidth={2} className="sidebar-section-chevron" aria-hidden="true" />
          </button>

          <div className="collapsible-body">
            <div className="collapsible-body-inner">
              <SpeakerLeaderboard
                entries={speakerLeaderboard}
                speakerColorMap={speakerColorMap}
                canRename={canRename}
                onRename={onRename}
                renaming={renamingSpeaker}
                message={renameMessage}
                activeSpeaker={activeSpeaker}
                onSpeakerSelect={onSpeakerSelect}
              />
            </div>
          </div>
        </section>
      )}

      {showCollaborators && (
        <section
          className={`sidebar-section sidebar-section--collapsible${collaboratorsOpen ? '' : ' is-collapsed'}`}
        >
            <button
              type="button"
              className="sidebar-section-toggle"
              onClick={() => setCollaboratorsOpen((open) => !open)}
              aria-expanded={collaboratorsOpen}
            >
              <span className="sidebar-section-toggle-text">
                <span className="sidebar-section-toggle-title">Collaborators</span>
                <span className="sidebar-section-toggle-hint">
                  {loadingCollaborators
                    ? 'Loading…'
                    : `${collaborators.length} shared`}
                </span>
              </span>
              <ChevronDown size={16} strokeWidth={2} className="sidebar-section-chevron" aria-hidden="true" />
            </button>

            <div className="collapsible-body">
              <div className="collapsible-body-inner sidebar-section-body">
                {loadingCollaborators ? (
                  <p className="sidebar-hint">Loading…</p>
                ) : collaborators.length === 0 ? (
                  <p className="sidebar-hint">Not shared with anyone yet.</p>
                ) : (
                  <ul className="collaborator-list">
                    {collaborators.map((collaborator) => (
                      <li key={collaborator.user_id} className="collaborator-item">
                        <div className="collaborator-info">
                          <div className="collaborator-name-row">
                            <span className="collaborator-name">
                              {collaborator.username || collaborator.email}
                            </span>
                            <span className={`badge badge--${collaborator.role}`}>{collaborator.role}</span>
                          </div>
                          {collaborator.username && (
                            <span className="collaborator-email">{collaborator.email}</span>
                          )}
                        </div>
                        <div className="collaborator-actions">
                          <select
                            value={collaborator.role}
                            onChange={(e) => handleRoleChange(collaborator.user_id, e.target.value)}
                            aria-label={`Role for ${collaborator.username || collaborator.email}`}
                          >
                            {ROLES.map((role) => (
                              <option key={role} value={role}>{role}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="text-btn text-btn--danger"
                            onClick={() => handleRemove(collaborator)}
                            aria-label={`Remove ${collaborator.username || collaborator.email}`}
                          >
                            Remove
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <form className="sidebar-form sidebar-share-form" onSubmit={handleShare}>
                  <div className="form-group">
                    <label htmlFor="sidebar-share-email">Add by email</label>
                    <input
                      id="sidebar-share-email"
                      type="email"
                      placeholder="friend@email.com"
                      value={shareEmail}
                      onChange={(e) => setShareEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="sidebar-share-role">Role</label>
                    <select
                      id="sidebar-share-role"
                      value={shareRole}
                      onChange={(e) => setShareRole(e.target.value)}
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" disabled={sharing}>
                    {sharing ? 'Sharing…' : 'Share'}
                  </button>
                </form>
                <p className="sidebar-hint">
                  They must already have an account. The quotebook appears on their dashboard — no invite email is sent.
                </p>
              </div>
            </div>
          </section>
      )}

      {showAccess && (
        <>
          {(showSpeakers || showCollaborators) && <hr className="sidebar-divider sidebar-divider--visible" />}

          <section
            className={`sidebar-section sidebar-section--collapsible${accessOpen ? '' : ' is-collapsed'}`}
          >
            <button
              type="button"
              className="sidebar-section-toggle"
              onClick={() => setAccessOpen((open) => !open)}
              aria-expanded={accessOpen}
            >
              <span className="sidebar-section-toggle-text">
                <span className="sidebar-section-toggle-title">Your access</span>
                <span className="sidebar-section-toggle-hint">
                  {userRole} · leave anytime
                </span>
              </span>
              <ChevronDown size={16} strokeWidth={2} className="sidebar-section-chevron" aria-hidden="true" />
            </button>

            <div className="collapsible-body">
              <div className="collapsible-body-inner sidebar-section-body sidebar-access-body">
                <div className="sidebar-access-card">
                  <p className="sidebar-hint sidebar-access-hint">
                    You were invited to this quotebook. Leaving removes it from your dashboard.
                  </p>
                  <button
                    type="button"
                    className="sidebar-leave-btn"
                    onClick={onLeave}
                    disabled={leaving}
                  >
                    <LogOut size={14} strokeWidth={2} aria-hidden="true" />
                    {leaving ? 'Leaving…' : 'Leave quotebook'}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {error && <p className="error sidebar-feedback">{error}</p>}
      {message && <p className="success sidebar-feedback">{message}</p>}
    </aside>
  )
}
