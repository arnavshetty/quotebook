import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { BookPageContent } from './BookPageItems'
import useMediaQuery from '../hooks/useMediaQuery'
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
  const singlePage = useMediaQuery('(max-width: 600px)')
  const [unitIndex, setUnitIndex] = useState(0)
  const [turnDirection, setTurnDirection] = useState(null)

  const {
    shellRef,
    probeRef,
    groupsMeasureRef,
    groups,
    spreads,
    pages,
    isReady,
    columnWidthPx,
  } = useMeasuredBookSpreads(quotes, bookSort, singlePage)

  const totalUnits = singlePage ? pages.length : spreads.length
  const currentSpread = !singlePage ? spreads[unitIndex] : null
  const currentPage = singlePage ? pages[unitIndex] : null

  const leftPageNumber = singlePage ? unitIndex + 1 : unitIndex * 2 + 1
  const rightPageNumber = unitIndex * 2 + 2
  const totalPages = singlePage ? pages.length : spreads.length * 2

  useEffect(() => {
    setUnitIndex(0)
    setTurnDirection(null)
  }, [bookSort, quotes.length, singlePage])

  useEffect(() => {
    if (unitIndex >= totalUnits && totalUnits > 0) {
      setUnitIndex(totalUnits - 1)
    }
  }, [unitIndex, totalUnits])

  const goToUnit = useCallback((nextIndex, direction) => {
    if (nextIndex < 0 || nextIndex >= totalUnits) return
    setTurnDirection(direction)
    setUnitIndex(nextIndex)
  }, [totalUnits])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        goToUnit(unitIndex - 1, 'back')
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        goToUnit(unitIndex + 1, 'forward')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goToUnit, unitIndex])

  const shellClassName = `book-shell${singlePage ? ' book-shell--single-page' : ''}`

  if (quotes.length === 0) {
    return (
      <section className="book-view">
        <div className={`${shellClassName} book-shell--empty`}>
          {singlePage ? (
            <div className="book-spread book-spread--single">
              <BookPageSide
                items={[]}
                pageNumber={1}
                title={quotebookTitle}
              >
                <div className="book-page-body book-page-body--centered">
                  <p className="book-empty-message">This quotebook has no pages yet.</p>
                </div>
              </BookPageSide>
            </div>
          ) : (
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
          )}
        </div>
      </section>
    )
  }

  const spreadClassName = `book-spread${singlePage ? ' book-spread--single' : ''}${turnDirection ? ` book-spread--turn-${turnDirection}` : ''}`

  return (
    <section className="book-view">
      <div className={shellClassName} ref={shellRef}>
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

        {isReady && (singlePage ? currentPage : currentSpread) ? (
          <div key={unitIndex} className={spreadClassName}>
            {singlePage ? (
              <BookPageSide
                items={currentPage}
                pageNumber={leftPageNumber}
                title={quotebookTitle}
              />
            ) : (
              <>
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
              </>
            )}
          </div>
        ) : (
          <div className={`${spreadClassName} book-spread--measuring`} aria-hidden="true">
            <BookPageSide items={[]} title={quotebookTitle} />
            {!singlePage && (
              <>
                <div className="book-gutter" />
                <BookPageSide items={[]} title={quotebookTitle} isRight />
              </>
            )}
          </div>
        )}
      </div>

      <nav className="book-nav" aria-label="Page navigation">
        <button
          type="button"
          className="book-nav-btn"
          onClick={() => goToUnit(unitIndex - 1, 'back')}
          disabled={!isReady || unitIndex === 0}
          aria-label={singlePage ? 'Previous page' : 'Previous spread'}
        >
          <ChevronLeft size={18} strokeWidth={2} aria-hidden="true" />
          Previous
        </button>
        <span className="book-nav-status">
          {isReady
            ? singlePage
              ? `Page ${leftPageNumber} of ${totalPages}`
              : `Pages ${leftPageNumber}–${rightPageNumber} of ${totalPages}`
            : 'Preparing pages…'}
        </span>
        <button
          type="button"
          className="book-nav-btn"
          onClick={() => goToUnit(unitIndex + 1, 'forward')}
          disabled={!isReady || unitIndex >= totalUnits - 1}
          aria-label={singlePage ? 'Next page' : 'Next spread'}
        >
          Next
          <ChevronRight size={18} strokeWidth={2} aria-hidden="true" />
        </button>
      </nav>
    </section>
  )
}
