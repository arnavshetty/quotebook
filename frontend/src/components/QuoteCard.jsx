export default function QuoteCard({ quote, canDelete, onDelete }) {
  const formatDate = () => {
    const parts = [quote.month, quote.day_range, quote.year].filter(Boolean)
    return parts.length ? parts.join(' ') : 'Date unknown'
  }

  return (
    <article className="quote-card">
      {canDelete && (
        <button
          type="button"
          className="delete-btn"
          onClick={() => onDelete(quote.id)}
          aria-label="Delete quote"
        >
          &times;
        </button>
      )}

      {quote.lines?.map((line, index) => (
        <blockquote key={index} className="quote-line">
          {line.context && line.context_position === 'Before' && (
            <span className="context-text">[{line.context}] </span>
          )}
          &ldquo;{line.quote}&rdquo; &mdash; <strong>{line.author}</strong>
          {line.context && line.context_position === 'After' && (
            <span className="context-text"> [{line.context}]</span>
          )}
        </blockquote>
      ))}

      <div className="quote-meta">
        <small>{formatDate()}</small>
        {quote.creator_name && <small>Added by {quote.creator_name}</small>}
      </div>
    </article>
  )
}
