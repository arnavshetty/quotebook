import { useEffect, useRef, useState } from 'react'
import { LogOut, Pencil, X } from 'lucide-react'
import { api } from '../api/client'
import CollapsibleSection from './CollapsibleSection'
import RoleBadgeSelect from './RoleBadgeSelect'
import SpeakerLeaderboard from './SpeakerLeaderboard'

const ROLES = ['viewer', 'contributor', 'admin']
const MOBILE_SIDEBAR_QUERY = '(max-width: 900px)'

function getInitialSectionOpen() {
  if (typeof window === 'undefined') return true
  return !window.matchMedia(MOBILE_SIDEBAR_QUERY).matches
}

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
  const [speakersOpen, setSpeakersOpen] = useState(getInitialSectionOpen)
  const [collaboratorsOpen, setCollaboratorsOpen] = useState(getInitialSectionOpen)
  const [accessOpen, setAccessOpen] = useState(getInitialSectionOpen)
  const [editingRoleUserId, setEditingRoleUserId] = useState(null)
  const roleSelectRef = useRef(null)

  const canManageRoles = userRole === 'owner' || userRole === 'admin'
  const showAccess = canLeave && userRole && userRole !== 'owner'

  useEffect(() => {
    if (!editingRoleUserId || !roleSelectRef.current) return
    roleSelectRef.current.focus()
    roleSelectRef.current.showPicker?.()
  }, [editingRoleUserId])

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
    setEditingRoleUserId(null)
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
  const canClearSpeakerFilter = Boolean(activeSpeaker && onSpeakerSelect)

  return (
    <aside className="quotebook-sidebar">
      {showSpeakers && (
        <CollapsibleSection
          open={speakersOpen}
          onToggle={() => setSpeakersOpen((open) => !open)}
          title="Speakers"
          hint={
            canClearSpeakerFilter
              ? `Filtering · ${activeSpeaker}`
              : onSpeakerSelect
                ? 'Ranked by count · click to filter'
                : 'Ranked by count'
          }
          headerAction={
            canClearSpeakerFilter ? (
              <button
                type="button"
                className="icon-action-btn icon-action-btn--discard"
                onClick={() => onSpeakerSelect(activeSpeaker)}
                aria-label={`Clear speaker filter for ${activeSpeaker}`}
              >
                <X size={14} strokeWidth={2} aria-hidden="true" />
              </button>
            ) : null
          }
        >
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
        </CollapsibleSection>
      )}

      {showCollaborators && (
        <CollapsibleSection
          open={collaboratorsOpen}
          onToggle={() => setCollaboratorsOpen((open) => !open)}
          title="Collaborators"
          hint={loadingCollaborators ? 'Loading…' : `${collaborators.length} shared`}
          innerClassName="sidebar-section-body"
        >
                {loadingCollaborators ? (
                  <p className="sidebar-hint">Loading…</p>
                ) : collaborators.length === 0 ? (
                  <p className="sidebar-hint">Not shared with anyone yet.</p>
                ) : (
                  <ul className="collaborator-list">
                    {collaborators.map((collaborator) => {
                      const label = collaborator.username || collaborator.email
                      const isEditingRole = editingRoleUserId === collaborator.user_id

                      return (
                        <li key={collaborator.user_id} className="collaborator-item">
                          <div className="collaborator-info">
                            <div className="collaborator-name-wrap">
                              <span className="collaborator-name">{label}</span>
                              <div className="collaborator-role-wrap">
                                {isEditingRole ? (
                                  <select
                                    ref={roleSelectRef}
                                    className={`collaborator-role-select badge badge--${collaborator.role}`}
                                    value={collaborator.role}
                                    onChange={(e) => handleRoleChange(collaborator.user_id, e.target.value)}
                                    onBlur={() => setEditingRoleUserId(null)}
                                    aria-label={`Role for ${label}`}
                                  >
                                    {ROLES.map((role) => (
                                      <option key={role} value={role}>{role}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className={`badge badge--${collaborator.role}`}>
                                    {collaborator.role}
                                  </span>
                                )}
                                {canManageRoles && !isEditingRole && (
                                  <button
                                    type="button"
                                    className="icon-action-btn icon-action-btn--compact icon-action-btn--reveal"
                                    onClick={() => setEditingRoleUserId(collaborator.user_id)}
                                    aria-label={`Change role for ${label}`}
                                  >
                                    <Pencil size={11} strokeWidth={2} aria-hidden="true" />
                                  </button>
                                )}
                              </div>
                            </div>
                            {(collaborator.username || canManageRoles) && (
                              <div className="collaborator-meta-row">
                                {collaborator.username && (
                                  <span className="collaborator-email">{collaborator.email}</span>
                                )}
                                {canManageRoles && (
                                  <button
                                    type="button"
                                    className="text-btn text-btn--danger"
                                    onClick={() => handleRemove(collaborator)}
                                    aria-label={`Remove ${label}`}
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </li>
                      )
                    })}
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
                    <RoleBadgeSelect
                      id="sidebar-share-role"
                      value={shareRole}
                      onChange={setShareRole}
                      options={ROLES}
                    />
                  </div>
                  <button type="submit" disabled={sharing}>
                    {sharing ? 'Sharing…' : 'Share'}
                  </button>
                </form>
                <p className="sidebar-hint">
                  They must already have an account. The quotebook appears on their dashboard — no invite email is sent.
                </p>
        </CollapsibleSection>
      )}

      {showAccess && (
        <>
          {(showSpeakers || showCollaborators) && <hr className="sidebar-divider sidebar-divider--visible" />}

          <CollapsibleSection
            open={accessOpen}
            onToggle={() => setAccessOpen((open) => !open)}
            title="Your access"
            hint={`${userRole} · leave anytime`}
            innerClassName="sidebar-section-body sidebar-access-body"
          >
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
          </CollapsibleSection>
        </>
      )}

      {error && <p className="error sidebar-feedback">{error}</p>}
      {message && <p className="success sidebar-feedback">{message}</p>}
    </aside>
  )
}
