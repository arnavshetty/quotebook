import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { BookPageContent } from './BookPageItems'
import useMeasuredBookSpreads from '../hooks/useMeasuredBookSpreads'

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

  const {
    shellRef,
    probeRef,
    groupsMeasureRef,
    groups,
    spreads,
    isReady,
    columnWidthPx,
  } = useMeasuredBookSpreads(quotes, bookSort)

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

  if (quotes.length === 0) {
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
      <div className="book-shell" ref={shellRef}>
        <div className="book-measure-probe" ref={probeRef} aria-hidden="true">
          <BookPageSide items={[]} pageNumber={1} title={quotebookTitle} />
        </div>

        {groups.length > 0 && columnWidthPx && (
          <div
            ref={groupsMeasureRef}
            className="book-measure-groups"
            style={{ width: columnWidthPx }}
            aria-hidden="true"
          >
            {groups.map((group, index) => (
              <div key={index} data-measure-group={index} className="book-measure-group">
                <BookPageContent items={group.items} />
              </div>
            ))}
          </div>
        )}

        {isReady && currentSpread ? (
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
        ) : (
          <div className="book-spread book-spread--measuring" aria-hidden="true">
            <BookPageSide items={[]} title={quotebookTitle} />
            <div className="book-gutter" />
            <BookPageSide items={[]} title={quotebookTitle} isRight />
          </div>
        )}
      </div>

      <nav className="book-nav" aria-label="Page navigation">
        <button
          type="button"
          className="book-nav-btn"
          onClick={() => goToSpread(spreadIndex - 1, 'back')}
          disabled={!isReady || spreadIndex === 0}
          aria-label="Previous spread"
        >
          <ChevronLeft size={18} strokeWidth={2} aria-hidden="true" />
          Previous
        </button>
        <span className="book-nav-status">
          {isReady
            ? `Pages ${leftPageNumber}–${rightPageNumber} of ${totalPages}`
            : 'Preparing pages…'}
        </span>
        <button
          type="button"
          className="book-nav-btn"
          onClick={() => goToSpread(spreadIndex + 1, 'forward')}
          disabled={!isReady || spreadIndex >= totalSpreads - 1}
          aria-label="Next spread"
        >
          Next
          <ChevronRight size={18} strokeWidth={2} aria-hidden="true" />
        </button>
      </nav>
    </section>
  )
}
