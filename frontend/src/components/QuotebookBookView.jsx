import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { BookPageContent } from './BookPageItems'
import useMediaQuery from '../hooks/useMediaQuery'
import useMeasuredBookSpreads from '../hooks/useMeasuredBookSpreads'
import useBookPageDrag from '../hooks/useBookPageDrag'

const BUTTON_SETTLE_MS = 780
const DRAG_SETTLE_MS = 400
const COMMIT_FLOOR = 0.35
/** Stop shy of a full 180° so the leaf never rests covering the spine. */
const COMMIT_PROGRESS = 0.92

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

function BookUnit({
  singlePage,
  pages,
  spreads,
  unitIndex,
  quotebookTitle,
}) {
  if (singlePage) {
    const page = pages[unitIndex]
    if (!page) return null
    return (
      <BookPageSide
        items={page}
        pageNumber={unitIndex + 1}
        title={quotebookTitle}
      />
    )
  }

  const spread = spreads[unitIndex]
  if (!spread) return null

  return (
    <>
      <BookPageSide
        items={spread.left}
        pageNumber={unitIndex * 2 + 1}
        title={quotebookTitle}
      />
      <div className="book-gutter" aria-hidden="true" />
      <BookPageSide
        items={spread.right}
        pageNumber={unitIndex * 2 + 2}
        title={quotebookTitle}
        isRight
      />
    </>
  )
}

function curlLeafStyle(progress, direction, settling, settleMs = DRAG_SETTLE_MS) {
  const p = Math.min(1, Math.max(0, progress))
  const angle = direction === 'forward' ? -180 * p : 180 * p
  const origin = direction === 'forward' ? 'left center' : 'right center'
  const shade = Math.sin(Math.min(p, COMMIT_PROGRESS) * Math.PI) * 0.55

  return {
    transform: `rotateY(${angle}deg)`,
    transformOrigin: origin,
    transition: settling
      ? `transform ${settleMs}ms cubic-bezier(0.22, 1, 0.36, 1)`
      : 'none',
    ['--curl-shade']: String(shade),
    ['--curl-shade-dir']: direction === 'forward' ? '90deg' : '270deg',
  }
}

function SinglePageCurl({
  pages,
  turn,
  turnProgress,
  quotebookTitle,
  onSettleEnd,
}) {
  const spreadClass = 'book-spread book-spread--single'

  return (
    <>
      <div className={`${spreadClass} book-spread--curl-base`}>
        <BookPageSide
          items={pages[turn.toIndex]}
          pageNumber={turn.toIndex + 1}
          title={quotebookTitle}
        />
      </div>
      <div
        className="book-curl-leaf"
        style={curlLeafStyle(
          turnProgress,
          turn.direction,
          turn.settling,
          turn.settleMs,
        )}
        onTransitionEnd={turn.settling ? onSettleEnd : undefined}
      >
        <div className={`${spreadClass} book-curl-face book-curl-face--front`}>
          <BookPageSide
            items={pages[turn.fromIndex]}
            pageNumber={turn.fromIndex + 1}
            title={quotebookTitle}
          />
        </div>
        <div className="book-curl-face book-curl-face--back" aria-hidden="true" />
      </div>
    </>
  )
}

function SpreadPageCurl({
  spreads,
  turn,
  turnProgress,
  quotebookTitle,
  onSettleEnd,
}) {
  const from = spreads[turn.fromIndex]
  const to = spreads[turn.toIndex]
  if (!from || !to) return null

  const forward = turn.direction === 'forward'
  // Forward: keep current left, reveal next right under the flipping right page.
  // Back: keep current right, reveal previous left under the flipping left page.
  const steadyLeft = forward ? from.left : to.left
  const steadyRight = forward ? to.right : from.right
  const leafFront = forward ? from.right : from.left
  const leafBack = forward ? to.left : to.right
  const leafFrontNumber = forward
    ? turn.fromIndex * 2 + 2
    : turn.fromIndex * 2 + 1
  const leafBackNumber = forward
    ? turn.toIndex * 2 + 1
    : turn.toIndex * 2 + 2
  const steadyLeftNumber = forward
    ? turn.fromIndex * 2 + 1
    : turn.toIndex * 2 + 1
  const steadyRightNumber = forward
    ? turn.toIndex * 2 + 2
    : turn.fromIndex * 2 + 2

  return (
    <div className="book-spread book-spread--curl-spread">
      <BookPageSide
        items={steadyLeft}
        pageNumber={steadyLeftNumber}
        title={quotebookTitle}
      />
      <div className="book-gutter book-gutter--curl" aria-hidden="true" />
      <BookPageSide
        items={steadyRight}
        pageNumber={steadyRightNumber}
        title={quotebookTitle}
        isRight
      />

      <div
        className={`book-curl-leaf book-curl-leaf--${forward ? 'right' : 'left'}`}
        style={curlLeafStyle(
          turnProgress,
          turn.direction,
          turn.settling,
          turn.settleMs,
        )}
        onTransitionEnd={turn.settling ? onSettleEnd : undefined}
      >
        <div className="book-curl-face book-curl-face--front">
          <BookPageSide
            items={leafFront}
            pageNumber={leafFrontNumber}
            title={quotebookTitle}
            isRight={forward}
          />
        </div>
        <div className="book-curl-face book-curl-face--back book-curl-face--back-content">
          <BookPageSide
            items={leafBack}
            pageNumber={leafBackNumber}
            title={quotebookTitle}
            isRight={!forward}
          />
        </div>
      </div>
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
  const [turn, setTurn] = useState(null)

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
  const leftPageNumber = singlePage ? unitIndex + 1 : unitIndex * 2 + 1
  const rightPageNumber = unitIndex * 2 + 2
  const totalPages = singlePage ? pages.length : spreads.length * 2
  const isTurning = turn != null
  const canGoForward = unitIndex < totalUnits - 1
  const canGoBack = unitIndex > 0

  useEffect(() => {
    setUnitIndex(0)
    setTurn(null)
  }, [bookSort, quotes.length, singlePage])

  useEffect(() => {
    if (unitIndex >= totalUnits && totalUnits > 0) {
      setUnitIndex(totalUnits - 1)
      setTurn(null)
    }
  }, [unitIndex, totalUnits])

  const finishCurlSettle = useCallback((event) => {
    if (event?.target != null && event.target !== event.currentTarget) return
    if (event?.propertyName && event.propertyName !== 'transform') return

    setTurn((current) => {
      if (!current?.settling) return current
      if (current.commit) {
        setUnitIndex(current.toIndex)
      }
      // Clear in the same update so we never paint a fully-flipped leaf over the spine.
      return null
    })
  }, [])

  useEffect(() => {
    if (!turn?.settling) return undefined

    const timeoutId = window.setTimeout(
      () => finishCurlSettle(),
      (turn.settleMs ?? DRAG_SETTLE_MS) + 40,
    )
    return () => window.clearTimeout(timeoutId)
  }, [turn?.settling, turn?.settleMs, turn?.direction, turn?.commit, finishCurlSettle])

  const settleTurn = useCallback((next) => {
    const settleMs = next.settleMs ?? DRAG_SETTLE_MS
    const targetProgress = next.commit ? COMMIT_PROGRESS : 0
    // Only bump drag commits that barely passed the threshold; buttons start at 0.
    const startProgress = next.commit && next.progress > 0
      ? Math.max(next.progress, COMMIT_FLOOR)
      : next.progress

    setTurn({
      ...next,
      settleMs,
      progress: startProgress,
      settling: true,
    })
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTurn((current) => {
          if (!current?.settling) return current
          return {
            ...current,
            progress: targetProgress,
          }
        })
      })
    })
  }, [])

  const goToUnit = useCallback((nextIndex, direction) => {
    if (isTurning) return
    if (nextIndex < 0 || nextIndex >= totalUnits || nextIndex === unitIndex) return

    const reducedMotion = typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reducedMotion) {
      setUnitIndex(nextIndex)
      return
    }

    settleTurn({
      direction,
      progress: 0,
      commit: true,
      fromIndex: unitIndex,
      toIndex: nextIndex,
      settleMs: BUTTON_SETTLE_MS,
    })
  }, [isTurning, settleTurn, totalUnits, unitIndex])

  const goPrevious = useCallback(() => {
    goToUnit(unitIndex - 1, 'back')
  }, [goToUnit, unitIndex])

  const goNext = useCallback(() => {
    goToUnit(unitIndex + 1, 'forward')
  }, [goToUnit, unitIndex])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        goPrevious()
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        goNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goNext, goPrevious])

  const handleDragStart = useCallback((direction) => {
    const toIndex = direction === 'forward' ? unitIndex + 1 : unitIndex - 1
    setTurn({
      direction,
      progress: 0,
      settling: false,
      commit: false,
      fromIndex: unitIndex,
      toIndex,
    })
  }, [unitIndex])

  const handleDragMove = useCallback((progress, direction) => {
    setTurn((current) => {
      if (!current || current.settling) return current
      return { ...current, direction, progress }
    })
  }, [])

  const handleDragEnd = useCallback((commit, direction, progress) => {
    const fromIndex = turn?.fromIndex ?? unitIndex
    const toIndex = turn?.toIndex
      ?? (direction === 'forward' ? unitIndex + 1 : unitIndex - 1)

    settleTurn({
      direction,
      progress: commit ? Math.max(progress, COMMIT_FLOOR) : progress,
      commit,
      fromIndex,
      toIndex,
      settleMs: DRAG_SETTLE_MS,
    })
  }, [settleTurn, turn?.fromIndex, turn?.toIndex, unitIndex])

  const canDrag = isReady && totalUnits > 1 && !turn?.settling

  useBookPageDrag(shellRef, {
    enabled: canDrag,
    canGoForward,
    canGoBack,
    onDragStart: handleDragStart,
    onDragMove: handleDragMove,
    onDragEnd: handleDragEnd,
  })

  const shellClassName = [
    'book-shell',
    singlePage ? 'book-shell--single-page' : '',
    canDrag || isTurning ? 'book-shell--swipeable' : '',
    isTurning ? 'book-shell--curling' : '',
  ].filter(Boolean).join(' ')

  const spreadBaseClass = `book-spread${singlePage ? ' book-spread--single' : ''}`
  const turnProgress = turn?.progress ?? 0

  if (quotes.length === 0) {
    return (
      <section className="book-view">
        <div className={`${shellClassName} book-shell--empty`}>
          {singlePage ? (
            <div className={spreadBaseClass}>
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
            <div className={spreadBaseClass}>
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

        {isReady && totalUnits > 0 ? (
          <div className={`book-stage${isTurning ? ' book-stage--curling' : ''}`}>
            {isTurning ? (
              singlePage ? (
                <SinglePageCurl
                  pages={pages}
                  turn={turn}
                  turnProgress={turnProgress}
                  quotebookTitle={quotebookTitle}
                  onSettleEnd={finishCurlSettle}
                />
              ) : (
                <SpreadPageCurl
                  spreads={spreads}
                  turn={turn}
                  turnProgress={turnProgress}
                  quotebookTitle={quotebookTitle}
                  onSettleEnd={finishCurlSettle}
                />
              )
            ) : (
              <div className={spreadBaseClass}>
                <BookUnit
                  singlePage={singlePage}
                  pages={pages}
                  spreads={spreads}
                  unitIndex={unitIndex}
                  quotebookTitle={quotebookTitle}
                />
              </div>
            )}
          </div>
        ) : (
          <div className={`${spreadBaseClass} book-spread--measuring`} aria-hidden="true">
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
          onClick={goPrevious}
          disabled={!isReady || !canGoBack || isTurning}
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
          onClick={goNext}
          disabled={!isReady || !canGoForward || isTurning}
          aria-label={singlePage ? 'Next page' : 'Next spread'}
        >
          Next
          <ChevronRight size={18} strokeWidth={2} aria-hidden="true" />
        </button>
      </nav>
    </section>
  )
}
