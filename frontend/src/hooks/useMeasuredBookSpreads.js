import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { buildBookGroups, buildBookSpreads } from '../lib/bookLayout'

function readPageContentHeight(probeEl) {
  const body = probeEl.querySelector('.book-page-body')
  if (!body) return null
  return Math.max(body.clientHeight, 120)
}

function readPageColumnWidth(probeEl) {
  if (!probeEl) return null
  return probeEl.clientWidth
}

function readGroupHeights(rootEl, groupCount) {
  if (!rootEl || groupCount === 0) return null

  const heights = []
  for (let index = 0; index < groupCount; index += 1) {
    const body = rootEl.querySelector(`[data-measure-group="${index}"] .book-page-body`)
    if (!body) {
      heights.push(0)
      continue
    }
    heights.push(body.scrollHeight)
  }

  return heights
}

export default function useMeasuredBookSpreads(quotes, bookSort) {
  const shellRef = useRef(null)
  const probeRef = useRef(null)
  const groupsMeasureRef = useRef(null)

  const groups = useMemo(
    () => buildBookGroups(quotes, bookSort),
    [quotes, bookSort],
  )

  const [pageCapacityPx, setPageCapacityPx] = useState(null)
  const [columnWidthPx, setColumnWidthPx] = useState(null)
  const [groupHeights, setGroupHeights] = useState(null)

  useLayoutEffect(() => {
    const shell = shellRef.current
    const probe = probeRef.current
    if (!shell || !probe) return undefined

    const updateMetrics = () => {
      const capacity = readPageContentHeight(probe)
      const width = readPageColumnWidth(probe)
      if (capacity && capacity > 0) {
        setPageCapacityPx((prev) => (prev === capacity ? prev : capacity))
      }
      if (width && width > 0) {
        setColumnWidthPx((prev) => (prev === width ? prev : width))
      }
    }

    updateMetrics()

    const observer = new ResizeObserver(updateMetrics)
    observer.observe(shell)
    observer.observe(probe)

    return () => observer.disconnect()
  }, [quotes.length, bookSort])

  useLayoutEffect(() => {
    if (!groups.length || !pageCapacityPx || !columnWidthPx) {
      setGroupHeights(null)
      return undefined
    }

    const root = groupsMeasureRef.current
    if (!root) return undefined

    const heights = readGroupHeights(root, groups.length)
    if (heights) {
      setGroupHeights(heights)
    }

    return undefined
  }, [groups, pageCapacityPx, columnWidthPx, quotes, bookSort])

  const spreads = useMemo(
    () => buildBookSpreads(quotes, bookSort, pageCapacityPx, groupHeights),
    [quotes, bookSort, pageCapacityPx, groupHeights],
  )

  const isReady = Boolean(
    pageCapacityPx
    && groupHeights?.length === groups.length
    && (groups.length === 0 || spreads.length > 0),
  )

  return {
    shellRef,
    probeRef,
    groupsMeasureRef,
    groups,
    spreads,
    isReady,
    pageCapacityPx,
    columnWidthPx,
  }
}
