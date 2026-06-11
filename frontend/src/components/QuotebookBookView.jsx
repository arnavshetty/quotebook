import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { buildBookSpreads } from '../lib/bookLayout'

function BookHeading({ level, text }) {
  if (level === 1) return <h1 className="book-heading book-heading--1">{text}</h1>
  if (level === 2) return <h2 className="book-heading book-heading--2">{text}</h2>
  if (level === 3) return <h3 className="book-heading book-heading--3">{text}</h3>
  return <h4 className="book-heading book-heading--4">{text}</h4>
}

function BookQuote({ quote }) {
  return (
    <article className="book-quote">
      {quote.lines?.map((line, index) => (
        <blockquote key={index} className="book-quote-line">
          {line.context && line.context_position === 'Before' && (
            <span className="context-text">[{line.context}] </span>
          )}
          <span className="book-quote-text">&ldquo;{line.quote}&rdquo;</span>
          {' '}
          <span className="book-quote-author">— {line.author}</span>
          {line.context && line.context_position === 'After' && (
            <span className="context-text"> [{line.context}]</span>
          )}
        </blockquote>
      ))}
    </article>
  )
}

function BookPageContent({ items }) {
  if (!items.length) {
    return <div className="book-page-body book-page-body--blank" aria-hidden="true" />
  }

  return (
    <div className="book-page-body">
      {items.map((item, index) => {
        if (item.type === 'heading') {
          return (
            <BookHeading
              key={`heading-${index}-${item.text}-${item.level}`}
              level={item.level}
              text={item.text}
            />
          )
        }

        return (
          <BookQuote
            key={`quote-${item.quote.id}-${index}`}
            quote={item.quote}
          />
        )
      })}
    </div>
  )
}

function BookPageSide({
  items,
  pageNumber,
  title,
  isRight,
  children,
}) {
  return (
    <div className={`book-page${isRight ? ' book-page--right' : ' book-page--left'}`}>
      <header className="book-page-header">
        <span className="book-page-title">{title}</span>
      </header>

      {children ?? <BookPageContent items={items} />}

      {pageNumber != null && (
        <footer className="book-page-footer">
          <span className="book-page-number">{pageNumber}</span>
        </footer>
      )}
    </div>
  )
}

export default function QuotebookBookView({
  quotes,
  quotebookTitle,
  bookSort,
}) {
  const [spreadIndex, setSpreadIndex] = useState(0)
  const [turnDirection, setTurnDirection] = useState(null)

  const spreads = useMemo(
    () => buildBookSpreads(quotes, bookSort),
    [quotes, bookSort],
  )

  const totalSpreads = spreads.length
  const totalPages = totalSpreads * 2
  const currentSpread = spreads[spreadIndex]
  const leftPageNumber = spreadIndex * 2 + 1
  const rightPageNumber = spreadIndex * 2 + 2

  useEffect(() => {
    setSpreadIndex(0)
    setTurnDirection(null)
  }, [bookSort, quotes.length])

  useEffect(() => {
    if (spreadIndex >= totalSpreads && totalSpreads > 0) {
      setSpreadIndex(totalSpreads - 1)
    }
  }, [spreadIndex, totalSpreads])

  const goToSpread = useCallback((nextIndex, direction) => {
    if (nextIndex < 0 || nextIndex >= totalSpreads) return
    setTurnDirection(direction)
    setSpreadIndex(nextIndex)
  }, [totalSpreads])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        goToSpread(spreadIndex - 1, 'back')
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        goToSpread(spreadIndex + 1, 'forward')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goToSpread, spreadIndex])

  if (totalSpreads === 0) {
    return (
      <section className="book-view">
        <div className="book-shell book-shell--empty">
          <div className="book-spread">
            <BookPageSide
              items={[]}
              pageNumber={1}
              title={quotebookTitle}
            />
            <div className="book-gutter" aria-hidden="true" />
            <BookPageSide
              items={[]}
              pageNumber={2}
              title={quotebookTitle}
              isRight
            >
              <div className="book-page-body book-page-body--centered">
                <p className="book-empty-message">This quotebook has no pages yet.</p>
              </div>
            </BookPageSide>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="book-view">
      <div className="book-shell">
        <div
          key={spreadIndex}
          className={`book-spread${turnDirection ? ` book-spread--turn-${turnDirection}` : ''}`}
        >
          <BookPageSide
            items={currentSpread.left}
            pageNumber={leftPageNumber}
            title={quotebookTitle}
          />
          <div className="book-gutter" aria-hidden="true" />
          <BookPageSide
            items={currentSpread.right}
            pageNumber={rightPageNumber}
            title={quotebookTitle}
            isRight
          />
        </div>
      </div>

      <nav className="book-nav" aria-label="Page navigation">
        <button
          type="button"
          className="book-nav-btn"
          onClick={() => goToSpread(spreadIndex - 1, 'back')}
          disabled={spreadIndex === 0}
          aria-label="Previous spread"
        >
          <ChevronLeft size={18} strokeWidth={2} aria-hidden="true" />
          Previous
        </button>
        <span className="book-nav-status">
          Pages {leftPageNumber}–{rightPageNumber} of {totalPages}
        </span>
        <button
          type="button"
          className="book-nav-btn"
          onClick={() => goToSpread(spreadIndex + 1, 'forward')}
          disabled={spreadIndex >= totalSpreads - 1}
          aria-label="Next spread"
        >
          Next
          <ChevronRight size={18} strokeWidth={2} aria-hidden="true" />
        </button>
      </nav>
    </section>
  )
}
