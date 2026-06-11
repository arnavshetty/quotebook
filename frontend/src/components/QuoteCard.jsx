import { useState } from 'react'
import { Check, Copy, Pencil, X } from 'lucide-react'
import { formatQuoteForCopy } from '../lib/formatQuote'
import { formatQuoteDate } from '../lib/quoteSort'
import QuoteForm from './QuoteForm'
import QuoteLine from './QuoteLine'

export default function QuoteCard({
  quote,
  speakerColorMap,
  canModerate,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  editing,
  submitting,
}) {
  const [copied, setCopied] = useState(false)

  const initialValues = {
    month: quote.month || '',
    day_range: quote.day_range || '',
    year: quote.year ?? '',
    lines: quote.lines || [],
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formatQuoteForCopy(quote))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  if (editing) {
    return (
      <article className="quote-card quote-card--editing">
        <QuoteForm
          key={quote.id}
          initialValues={initialValues}
          onSubmit={onSaveEdit}
          onCancel={onCancelEdit}
          submitting={submitting}
          submitLabel="Save changes"
          idPrefix={`edit-${quote.id}`}
          speakerColorMap={speakerColorMap}
        />
      </article>
    )
  }

  return (
    <article className="quote-card">
      <div className="quote-card-header">
        <div className="quote-card-meta">
          <span className="quote-date">{formatQuoteDate(quote) || 'Date unknown'}</span>
          {quote.creator_name && (
            <span className="quote-creator">{quote.creator_name}</span>
          )}
        </div>
        <div className="quote-card-actions">
          <button
            type="button"
            className={`icon-action-btn${copied ? ' icon-action-btn--confirm' : ''}`}
            onClick={handleCopy}
            aria-label={copied ? 'Copied' : 'Copy quote'}
          >
            {copied ? (
              <Check size={14} strokeWidth={2} aria-hidden="true" />
            ) : (
              <Copy size={14} strokeWidth={2} aria-hidden="true" />
            )}
          </button>
          {canModerate && (
            <>
              <button
                type="button"
                className="icon-action-btn"
                onClick={onStartEdit}
                aria-label="Edit quote"
              >
                <Pencil size={14} strokeWidth={2} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="icon-action-btn icon-action-btn--discard"
                onClick={() => onDelete(quote.id)}
                aria-label="Delete quote"
              >
                <X size={14} strokeWidth={2} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </div>

      {quote.lines?.map((line, index) => (
        <QuoteLine
          key={index}
          line={line}
          variant="card"
          speakerColorMap={speakerColorMap}
        />
      ))}
    </article>
  )
}
