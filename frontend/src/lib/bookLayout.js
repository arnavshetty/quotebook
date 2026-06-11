import { getPrimarySpeaker } from './quoteSort'

const MONTH_INDEX = {
  January: 1,
  February: 2,
  March: 3,
  April: 4,
  May: 5,
  June: 6,
  July: 7,
  August: 8,
  September: 9,
  October: 10,
  November: 11,
  December: 12,
}

const PAGE_WEIGHT = 1120

export function quoteHasUserDate(quote) {
  return Boolean(quote.year || quote.month || quote.day_range)
}

function getUserDateSortKey(quote) {
  const month = quote.month ? MONTH_INDEX[quote.month] || 0 : 0
  const dayMatch = quote.day_range?.match(/\d+/)
  const day = dayMatch ? Number(dayMatch[0]) : 0
  const year = quote.year || 0

  if (!year && !month && !day) return null
  return year * 10000 + month * 100 + day
}

function compareByUserDate(a, b) {
  const keyA = getUserDateSortKey(a)
  const keyB = getUserDateSortKey(b)
  if (keyA !== null && keyB !== null && keyA !== keyB) return keyA - keyB
  if (keyA !== null && keyB === null) return -1
  if (keyA === null && keyB !== null) return 1
  return (a.id || 0) - (b.id || 0)
}

export function sortQuotesForBookView(quotes, mode = 'date') {
  const dated = quotes.filter(quoteHasUserDate)
  const undated = quotes.filter((quote) => !quoteHasUserDate(quote))

  if (mode === 'speaker') {
    dated.sort((a, b) => {
      const speakerDiff = getPrimarySpeaker(a).localeCompare(getPrimarySpeaker(b))
      if (speakerDiff !== 0) return speakerDiff
      return compareByUserDate(a, b)
    })
    undated.sort((a, b) => getPrimarySpeaker(a).localeCompare(getPrimarySpeaker(b)))
  } else {
    dated.sort(compareByUserDate)
  }

  return [...dated, ...undated]
}

function getDateParts(quote) {
  const dayMatch = quote.day_range?.match(/\d+/)
  return {
    year: quote.year || null,
    month: quote.month || null,
    day: dayMatch ? Number(dayMatch[0]) : null,
  }
}

function formatDayHeading(quote) {
  const { year, month, day } = getDateParts(quote)
  const monthNum = month ? MONTH_INDEX[month] : null

  if (monthNum && day && year) {
    const yy = String(year).slice(-2)
    return `${monthNum}/${day}/${yy}`
  }

  if (day && year) {
    const yy = String(year).slice(-2)
    return `${day}/${yy}`
  }

  return quote.day_range || null
}

function dayKey(quote) {
  const { year, month, day } = getDateParts(quote)
  if (day == null) return null
  return `${year || ''}-${month || ''}-${day}`
}

function appendDateHeadings(items, quote, state, levelOffset = 0) {
  const { year, month } = getDateParts(quote)
  const nextDayKey = dayKey(quote)
  const dayLabel = formatDayHeading(quote)

  if (year && year !== state.year) {
    items.push({ type: 'heading', level: 1 + levelOffset, text: String(year) })
    state.year = year
    state.month = null
    state.day = null
  }

  if (month && month !== state.month) {
    items.push({ type: 'heading', level: 2 + levelOffset, text: month })
    state.month = month
    state.day = null
  }

  if (nextDayKey && dayLabel && nextDayKey !== state.day) {
    items.push({ type: 'heading', level: 3 + levelOffset, text: dayLabel })
    state.day = nextDayKey
  }
}

function buildDateStream(quotes) {
  const items = []
  const state = { year: null, month: null, day: null, undated: false }

  for (const quote of quotes) {
    if (!quoteHasUserDate(quote)) {
      if (!state.undated) {
        items.push({ type: 'heading', level: 1, text: 'Undated' })
        state.undated = true
      }
      items.push({ type: 'quote', quote })
      continue
    }

    appendDateHeadings(items, quote, state, 0)
    items.push({ type: 'quote', quote })
  }

  return items
}

function buildSpeakerStream(quotes) {
  const items = []
  let lastSpeaker = null
  const dateState = { year: null, month: null, day: null }

  for (const quote of quotes) {
    const speaker = getPrimarySpeaker(quote)

    if (speaker !== lastSpeaker) {
      items.push({ type: 'heading', level: 1, text: speaker })
      lastSpeaker = speaker
      dateState.year = null
      dateState.month = null
      dateState.day = null
    }

    if (quoteHasUserDate(quote)) {
      appendDateHeadings(items, quote, dateState, 1)
    }

    items.push({ type: 'quote', quote })
  }

  return items
}

function itemWeight(item) {
  if (item.type === 'heading') {
    return 48 + item.text.length
  }

  if (item.type === 'quote') {
    let weight = 72
    for (const line of item.quote.lines || []) {
      weight += (line.quote?.length || 0)
        + (line.author?.length || 0)
        + (line.context?.length || 0)
        + 36
    }
    return weight
  }

  return 0
}

function groupItemsForPacking(items) {
  const groups = []
  let index = 0

  while (index < items.length) {
    if (items[index].type === 'quote') {
      groups.push({ items: [items[index]] })
      index += 1
      continue
    }

    const group = []
    while (index < items.length && items[index].type === 'heading') {
      group.push(items[index])
      index += 1
    }

    if (index < items.length && items[index].type === 'quote') {
      group.push(items[index])
      index += 1
    }

    if (group.length > 0) {
      groups.push({ items: group })
    }
  }

  return groups
}

function groupWeight(group) {
  return group.items.reduce((sum, item) => sum + itemWeight(item), 0)
}

function packSpreads(items) {
  if (items.length === 0) return []

  const groups = groupItemsForPacking(items)
  const spreads = []
  let current = { left: [], right: [] }
  let side = 'left'
  let weight = 0

  const pushSpread = () => {
    if (current.left.length || current.right.length) {
      spreads.push(current)
    }
    current = { left: [], right: [] }
    side = 'left'
    weight = 0
  }

  for (const group of groups) {
    const weightDelta = groupWeight(group)

    if (weight + weightDelta > PAGE_WEIGHT && current[side].length > 0) {
      if (side === 'left') {
        side = 'right'
        weight = 0
      } else {
        pushSpread()
      }
    }

    for (const item of group.items) {
      current[side].push(item)
    }
    weight += weightDelta
  }

  pushSpread()
  return spreads
}

export function buildBookSpreads(quotes, mode = 'date') {
  const sorted = sortQuotesForBookView(quotes, mode)
  const items = mode === 'speaker'
    ? buildSpeakerStream(sorted)
    : buildDateStream(sorted)

  return packSpreads(items)
}
