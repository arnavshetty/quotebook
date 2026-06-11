import { BookOpen, ChevronDown, List, Plus, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import QuotebookBookView from '../components/QuotebookBookView'
import QuoteCard from '../components/QuoteCard'
import QuoteForm from '../components/QuoteForm'
import QuotebookHeader from '../components/QuotebookHeader'
import QuotebookSidebar from '../components/QuotebookSidebar'
import {
  canAddQuotes,
  canLeaveQuotebook,
  canRenameSpeakers,
  canModerateQuote,
  isQuotebookOwner,
} from '../lib/quotePermissions'
import { filterAndSortQuotes, getSpeakerQuoteCounts, getSpeakersFromQuotes } from '../lib/quoteSort'
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

  const searchPlaceholder = {
    quote: 'Search quote text…',
    context: 'Search context…',
    date: 'e.g. June 2024',
    'added-by': 'Search who added it…',
  }[searchField]

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
    setAddSubmitting(true)
    setError('')
    try {
      const data = await api.addQuote(quotebookId, payload)
      setQuotes(data.quotes)
      if (data.quotes.length > 0) setAddQuoteOpen(false)
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setAddSubmitting(false)
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
      const data = await api.getQuotes(quotebookId)
      setQuotes(data.quotes)
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

  const showCollaborators = isOwner && viewMode === 'edit'
  const showSidebar = speakerLeaderboard.length > 0 || showCollaborators || canLeave

  return (
    <div className="quotebook-page">
      <Link to="/" className="back-link">← All quotebooks</Link>

      <div className={`quotebook-chrome${viewMode === 'book' ? ' quotebook-chrome--book' : ''}`}>
        <div className="quotebook-chrome-main">
          <div className="quotebook-chrome-title-row">
            {viewMode === 'edit' ? (
              <QuotebookHeader
                quotebookId={quotebookId}
                quotebook={quotebook}
                canEdit={isOwner}
                onUpdate={(updated) =>
                  setQuotebook((prev) => ({ ...prev, ...updated, user_role: prev.user_role }))
                }
              />
            ) : (
              <div className="quotebook-chrome-read-heading">
                <h2 className="quotebook-chrome-read-title">
                  {quotebook?.title || `Quotebook #${quotebookId}`}
                </h2>
                {quotes.length > 0 && (
                  <p className="quotebook-chrome-read-meta">
                    {quotes.length} quote{quotes.length === 1 ? '' : 's'}
                  </p>
                )}
              </div>
            )}
            {quotebook?.user_role && quotebook.user_role !== 'owner' && (
              <span className={`badge badge--${quotebook.user_role} quotebook-chrome-role`}>
                {quotebook.user_role}
              </span>
            )}
          </div>
        </div>

        <div className="quotebook-chrome-actions">
          {viewMode === 'book' && (
            <div className="quotebook-chrome-sort">
              <span className="quotebook-chrome-sort-label">Sort by</span>
              <div className="book-sort-toggle" role="group" aria-label="Sort pages by">
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
          )}

          <div className="quotebook-view-toggle" role="group" aria-label="View mode">
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

      <div
        className={[
          'quotebook-layout',
          viewMode === 'book' ? 'quotebook-layout--read' : '',
          showSidebar ? 'quotebook-layout--has-sidebar' : '',
        ].filter(Boolean).join(' ')}
      >
        <div className="quotebook-main">
          {error && <p className="error">{error}</p>}

          {viewMode === 'book' ? (
            <QuotebookBookView
              quotes={quotes}
              quotebookTitle={quotebook.title}
              bookSort={bookSort}
            />
          ) : (
            <>
              {canWrite && (
                <section className={`panel panel--collapsible${addQuoteOpen ? ' is-open' : ''}`}>
                  <button
                    type="button"
                    className="panel-toggle"
                    onClick={() => setAddQuoteOpen((open) => !open)}
                    aria-expanded={addQuoteOpen}
                  >
                    <span className="panel-toggle-label">
                      <Plus size={16} strokeWidth={2} className="panel-toggle-icon" aria-hidden="true" />
                      Add a quote
                    </span>
                    <ChevronDown size={16} strokeWidth={2} className="panel-toggle-chevron" aria-hidden="true" />
                  </button>
                  <div className="collapsible-body">
                    <div className="collapsible-body-inner panel-body">
                      <QuoteForm
                        onSubmit={handleAddQuote}
                        submitting={addSubmitting}
                        resetAfterSubmit
                        speakerColorMap={speakerColorMap}
                      />
                    </div>
                  </div>
                </section>
              )}

              <section className="quotes-display">
            <div className="quotes-display-header">
              <h3>
                {quotes.length === 0
                  ? 'No quotes yet'
                  : isFiltered
                    ? `${displayedQuotes.length} of ${quotes.length} quote${quotes.length === 1 ? '' : 's'}`
                    : `${quotes.length} quote${quotes.length === 1 ? '' : 's'}`}
              </h3>

              {quotes.length > 0 && (
                <div className="quote-toolbar">
                  <div className="toolbar-field toolbar-search-field">
                    <span className="toolbar-field-label">Search</span>
                    <div className="search-bar">
                      <select
                        className="search-bar-field"
                        value={searchField}
                        onChange={(e) => setSearchField(e.target.value)}
                        aria-label="Search in"
                      >
                        <option value="quote">Quote</option>
                        <option value="context">Context</option>
                        <option value="date">Date</option>
                        <option value="added-by">Added by</option>
                      </select>
                      <div className="search-bar-input-wrap">
                        <input
                          type="text"
                          className="search-bar-input"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder={searchPlaceholder}
                          aria-label="Search quotes"
                        />
                        {searchQuery && (
                          <button
                            type="button"
                            className="icon-action-btn icon-action-btn--discard search-bar-clear"
                            onClick={() => setSearchQuery('')}
                            aria-label="Clear search"
                          >
                            <X size={14} strokeWidth={2} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="toolbar-selects">
                    <label className="toolbar-field">
                      <span className="toolbar-field-label">Sort</span>
                      <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                        <option value="date-desc">Newest</option>
                        <option value="date-asc">Oldest</option>
                        <option value="speaker-asc">Speaker A–Z</option>
                        <option value="speaker-desc">Speaker Z–A</option>
                      </select>
                    </label>
                    <label className="toolbar-field">
                      <span className="toolbar-field-label">Speaker</span>
                      <select
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
                </div>
              )}
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
              displayedQuotes.map((quote) => (
                <QuoteCard
                  key={quote.id}
                  quote={quote}
                  speakerColorMap={speakerColorMap}
                  canEdit={canModerateQuote(quote, quotebook, user.id)}
                  canDelete={canModerateQuote(quote, quotebook, user.id)}
                  editing={editingQuoteId === quote.id}
                  submitting={editSubmitting && editingQuoteId === quote.id}
                  onStartEdit={() => setEditingQuoteId(quote.id)}
                  onSaveEdit={(payload) => handleUpdateQuote(quote.id, payload)}
                  onCancelEdit={() => setEditingQuoteId(null)}
                  onDelete={handleDelete}
                />
              ))
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
