import { BookOpen, Download, FileText, List, Plus, Printer } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import CollapsibleSection from '../components/CollapsibleSection'
import QuotebookBookView from '../components/QuotebookBookView'
import QuoteCard from '../components/QuoteCard'
import QuoteForm from '../components/QuoteForm'
import QuotebookHeader from '../components/QuotebookHeader'
import QuotebookSidebar from '../components/QuotebookSidebar'
import SearchInput from '../components/SearchInput'
import { pluralize } from '../lib/strings'
import {
  canAddQuotes,
  canLeaveQuotebook,
  canManageCollaborators,
  canRenameSpeakers,
  canModerateQuote,
  isQuotebookOwner,
} from '../lib/quotePermissions'
import { filterAndSortQuotes, getSpeakerQuoteCounts, getSpeakersFromQuotes } from '../lib/quoteSort'
import { findExactDuplicate } from '../lib/duplicateQuote'
import { downloadQuotebookExport } from '../lib/exportQuotebook'
import { buildSpeakerColorMap } from '../lib/speakerColors'

export default function Quotebook({ user }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const quotebookId = Number(id)

  const [quotebook, setQuotebook] = useState(null)
  const [quotes, setQuotes] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [addSubmitting, setAddSubmitting] = useState(false)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editingQuoteId, setEditingQuoteId] = useState(null)
  const [sortBy, setSortBy] = useState('date-desc')
  const [speakerFilter, setSpeakerFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchField, setSearchField] = useState('quote')
  const [leaving, setLeaving] = useState(false)
  const [viewMode, setViewMode] = useState('edit')
  const [bookSort, setBookSort] = useState('date')
  const [renamingSpeaker, setRenamingSpeaker] = useState(false)
  const [speakerRenameMessage, setSpeakerRenameMessage] = useState('')
  const [addQuoteOpen, setAddQuoteOpen] = useState(false)

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

  useEffect(() => {
    if (!loading && quotes.length === 0) {
      setAddQuoteOpen(true)
    }
  }, [loading, quotes.length])

  const canWrite = canAddQuotes(quotebook)
  const isOwner = isQuotebookOwner(quotebook)
  const canLeave = canLeaveQuotebook(quotebook)
  const canRename = canRenameSpeakers(quotebook)

  const speakers = useMemo(() => getSpeakersFromQuotes(quotes), [quotes])
  const speakerColorMap = useMemo(() => buildSpeakerColorMap(speakers), [speakers])
  const speakerLeaderboard = useMemo(() => getSpeakerQuoteCounts(quotes), [quotes])

  const displayedQuotes = useMemo(
    () => filterAndSortQuotes(quotes, {
      sortBy,
      speaker: speakerFilter,
      search: searchQuery,
      searchField,
    }),
    [quotes, sortBy, speakerFilter, searchQuery, searchField],
  )

  const isFiltered = Boolean(speakerFilter || searchQuery.trim())

  const handleAddQuote = async (payload) => {
    const duplicate = findExactDuplicate(quotes, payload)
    if (duplicate) {
      const message = 'This exact quote is already in the book (same text, speakers, context, and date).'
      setError(message)
      throw new Error(message)
    }

    setAddSubmitting(true)
    setError('')
    try {
      const data = await api.addQuote(quotebookId, payload)
      setQuotes(data.quotes)
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setAddSubmitting(false)
    }
  }

  const handleExport = async (format) => {
    if (!quotebook || quotes.length === 0) return
    setError('')
    try {
      await downloadQuotebookExport(quotes, quotebook, format, bookSort)
    } catch (err) {
      setError(err.message || 'Export failed.')
    }
  }

  const handleDelete = async (blockId) => {
    if (!window.confirm('Delete this quote?')) return
    setError('')
    try {
      await api.deleteQuote(blockId)
      setQuotes((prev) => prev.filter((q) => q.id !== blockId))
      if (editingQuoteId === blockId) setEditingQuoteId(null)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleUpdateQuote = async (blockId, payload) => {
    setEditSubmitting(true)
    setError('')
    try {
      const data = await api.updateQuote(blockId, payload)
      setQuotes(data.quotes)
      setEditingQuoteId(null)
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setEditSubmitting(false)
    }
  }

  const handleLeave = async () => {
    if (!window.confirm(`Leave "${quotebook.title}"? You will lose access unless re-invited.`)) return
    setLeaving(true)
    setError('')
    try {
      await api.leaveQuotebook(quotebookId)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLeaving(false)
    }
  }

  const handleRenameSpeaker = async (oldName, newName) => {
    setRenamingSpeaker(true)
    setError('')
    setSpeakerRenameMessage('')
    try {
      const { updatedCount } = await api.renameSpeaker(quotebookId, oldName, newName)
      await loadQuotes()
      if (speakerFilter === oldName) {
        setSpeakerFilter(newName)
      }
      setSpeakerRenameMessage(
        updatedCount === 0
          ? `No lines used the name "${oldName}".`
          : `Renamed "${oldName}" in ${updatedCount} line${updatedCount === 1 ? '' : 's'}.`,
      )
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setRenamingSpeaker(false)
    }
  }

  const handleSpeakerSelect = (speaker) => {
    setViewMode('edit')
    setSpeakerFilter((prev) => (prev === speaker ? '' : speaker))
  }

  if (loading) return <p className="page-message">Loading quotebook…</p>

  if (!quotebook) {
    return (
      <div className="quotebook-page">
        <Link to="/" className="back-link">← All quotebooks</Link>
        <p className="error quotebook-page-error">
          {error || 'Quotebook not found or access denied.'}
        </p>
      </div>
    )
  }

  const showCollaborators = canManageCollaborators(quotebook) && viewMode === 'edit'
  const showSidebar =
    speakerLeaderboard.length > 0 || showCollaborators || canLeave || Boolean(quotebook)

  return (
    <div className={`quotebook-page${viewMode === 'book' ? ' quotebook-page--read' : ''}`}>
      <Link to="/" className="back-link">← All quotebooks</Link>

      <div className="quotebook-chrome">
        <div className="quotebook-chrome-main">
          <div className="quotebook-chrome-title-row">
            <QuotebookHeader
              quotebookId={quotebookId}
              quotebook={quotebook}
              canEdit={isOwner && viewMode === 'edit'}
              onUpdate={(updated) =>
                setQuotebook((prev) => ({ ...prev, ...updated, user_role: prev.user_role }))
              }
            />
            {quotebook?.user_role && quotebook.user_role !== 'owner' && (
              <span className={`badge badge--${quotebook.user_role} quotebook-chrome-role`}>
                {quotebook.user_role}
              </span>
            )}
          </div>
        </div>

        <div className="quotebook-chrome-actions">
          {viewMode === 'book' && (
            <>
              <div className="quotebook-chrome-sort">
                <span className="segmented-label">Sort by</span>
                <div className="segmented-toggle" role="group" aria-label="Sort pages by">
                  <button
                    type="button"
                    className={bookSort === 'date' ? 'is-active' : ''}
                    onClick={() => setBookSort('date')}
                  >
                    Date
                  </button>
                  <button
                    type="button"
                    className={bookSort === 'speaker' ? 'is-active' : ''}
                    onClick={() => setBookSort('speaker')}
                  >
                    Speaker
                  </button>
                </div>
              </div>

              {quotes.length > 0 && (
                <div className="quotebook-chrome-export">
                  <span className="segmented-label">Export</span>
                  <div className="segmented-toggle" role="group" aria-label="Export quotebook">
                    <button type="button" onClick={() => handleExport('text')}>
                      <Download size={14} strokeWidth={2} aria-hidden="true" />
                      Text
                    </button>
                    <button type="button" onClick={() => handleExport('markdown')}>
                      <Download size={14} strokeWidth={2} aria-hidden="true" />
                      Markdown
                    </button>
                    <button type="button" onClick={() => handleExport('json')}>
                      <Download size={14} strokeWidth={2} aria-hidden="true" />
                      JSON
                    </button>
                    <button type="button" onClick={() => handleExport('pdf')}>
                      <FileText size={14} strokeWidth={2} aria-hidden="true" />
                      PDF
                    </button>
                    <button type="button" onClick={() => handleExport('print')}>
                      <Printer size={14} strokeWidth={2} aria-hidden="true" />
                      Print
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="segmented-toggle" role="group" aria-label="View mode">
            <button
              type="button"
              className={viewMode === 'edit' ? 'is-active' : ''}
              onClick={() => setViewMode('edit')}
            >
              <List size={15} strokeWidth={2} aria-hidden="true" />
              Edit
            </button>
            <button
              type="button"
              className={viewMode === 'book' ? 'is-active' : ''}
              onClick={() => setViewMode('book')}
            >
              <BookOpen size={15} strokeWidth={2} aria-hidden="true" />
              Read
            </button>
          </div>
        </div>
      </div>

      {error && <p className="error quotebook-page-error">{error}</p>}

      <div
        className={`quotebook-layout${viewMode === 'book' ? ' quotebook-layout--read' : ''}${showSidebar ? ' quotebook-layout--has-sidebar' : ''}`}
      >
        <div className="quotebook-main">
          {viewMode === 'book' ? (
            <QuotebookBookView
              quotes={quotes}
              quotebookTitle={quotebook?.title ?? 'Quotebook'}
              bookSort={bookSort}
            />
          ) : (
            <>
              {canWrite && (
                <CollapsibleSection
                  variant="panel"
                  open={addQuoteOpen}
                  onToggle={() => setAddQuoteOpen((open) => !open)}
                  toggleLabel="Add a quote"
                  toggleIcon={(
                    <Plus size={16} strokeWidth={2} className="panel-toggle-icon" aria-hidden="true" />
                  )}
                >
                  <QuoteForm
                    onSubmit={handleAddQuote}
                    submitting={addSubmitting}
                    resetAfterSubmit
                    speakerColorMap={speakerColorMap}
                  />
                </CollapsibleSection>
              )}

              <section className="quotes-display">
            <div className="quotes-display-header">
              <div className="quote-toolbar">
                <div
                  className="quotes-display-count toolbar-field"
                  aria-label={
                    quotes.length === 0
                      ? 'No quotes yet'
                      : isFiltered
                        ? `${displayedQuotes.length} of ${pluralize(quotes.length, 'quote')}`
                        : pluralize(quotes.length, 'quote')
                  }
                >
                  <span className="toolbar-field-label"># of Quotes</span>
                  <div className="toolbar-control quotes-display-count-bar" aria-hidden="true">
                    <span className="quotes-display-count-text">
                      {quotes.length === 0
                        ? '0'
                        : isFiltered
                          ? `${displayedQuotes.length} of ${quotes.length}`
                          : quotes.length}
                    </span>
                  </div>
                </div>

                {quotes.length > 0 && (
                  <>
                    <div className="toolbar-field toolbar-search-field">
                      <span className="toolbar-field-label">Search</span>
                      <SearchInput
                        variant="toolbar"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        onClear={() => setSearchQuery('')}
                        field={searchField}
                        onFieldChange={setSearchField}
                        ariaLabel="Search quotes"
                      />
                    </div>

                    <div className="toolbar-selects">
                      <label className="toolbar-field">
                        <span className="toolbar-field-label">Sort</span>
                        <select className="toolbar-control" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                          <option value="date-desc">Newest</option>
                          <option value="date-asc">Oldest</option>
                          <option value="speaker-asc">Speaker A–Z</option>
                          <option value="speaker-desc">Speaker Z–A</option>
                        </select>
                      </label>
                      <label className="toolbar-field">
                        <span className="toolbar-field-label">Speaker</span>
                        <select
                          className="toolbar-control"
                          value={speakerFilter}
                          onChange={(e) => setSpeakerFilter(e.target.value)}
                        >
                          <option value="">All</option>
                          {speakers.map((speaker) => (
                            <option key={speaker} value={speaker}>{speaker}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </>
                )}
              </div>
            </div>

            {quotes.length === 0 ? (
              <div className="empty-state">
                <strong>Nothing logged yet</strong>
                {canWrite ? 'Expand “Add a quote” above to log your first line.' : 'Check back once quotes are added.'}
              </div>
            ) : displayedQuotes.length === 0 ? (
              <div className="empty-state">
                <strong>No matching quotes</strong>
                {searchQuery.trim()
                  ? `Try different words or search in another field.`
                  : 'Try another speaker or show all speakers.'}
              </div>
            ) : (
              displayedQuotes.map((quote) => {
                const canModerate = canModerateQuote(quote, quotebook, user.id)
                return (
                  <QuoteCard
                    key={quote.id}
                    quote={quote}
                    speakerColorMap={speakerColorMap}
                    canModerate={canModerate}
                    editing={editingQuoteId === quote.id}
                    submitting={editSubmitting && editingQuoteId === quote.id}
                    onStartEdit={() => setEditingQuoteId(quote.id)}
                    onSaveEdit={(payload) => handleUpdateQuote(quote.id, payload)}
                    onCancelEdit={() => setEditingQuoteId(null)}
                    onDelete={handleDelete}
                  />
                )
              })
            )}
              </section>
            </>
          )}
        </div>

        {showSidebar && (
          <QuotebookSidebar
            quotebookId={quotebookId}
            showCollaborators={showCollaborators}
            speakerLeaderboard={speakerLeaderboard}
            speakerColorMap={speakerColorMap}
            canRename={canRename && viewMode === 'edit'}
            onRename={handleRenameSpeaker}
            renamingSpeaker={renamingSpeaker}
            renameMessage={speakerRenameMessage}
            activeSpeaker={viewMode === 'edit' ? speakerFilter : ''}
            onSpeakerSelect={viewMode === 'edit' ? handleSpeakerSelect : undefined}
            userRole={quotebook?.user_role}
            canLeave={canLeave}
            onLeave={handleLeave}
            leaving={leaving}
          />
        )}
      </div>
    </div>
  )
}
