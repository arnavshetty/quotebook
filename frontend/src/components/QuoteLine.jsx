import { getLineSpeakerStyle } from '../lib/speakerColors'

export default function QuoteLine({ line, variant = 'card', speakerColorMap }) {
  const isBook = variant === 'book'
  const quoteClass = isBook ? 'book-quote-text' : 'quote-text'
  const authorClass = isBook ? 'book-quote-author' : 'quote-author'

  return (
    <blockquote
      className={isBook ? 'book-quote-line' : 'quote-line speaker-bordered'}
      style={isBook ? undefined : getLineSpeakerStyle(line, speakerColorMap)}
    >
      {line.context && line.context_position === 'Before' && (
        <span className="context-text">[{line.context}] </span>
      )}
      <span className={quoteClass}>&ldquo;{line.quote}&rdquo;</span>
      {' '}
      <span className={authorClass}>— {line.author}</span>
      {line.context && line.context_position === 'After' && (
        <span className="context-text"> [{line.context}]</span>
      )}
    </blockquote>
  )
}
