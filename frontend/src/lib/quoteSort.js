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

export function getPrimarySpeaker(quote) {
  const lines = quote.lines || []
  const withAuthor = lines.find((line) => line.author?.trim())
  return (withAuthor?.author || lines[0]?.author || '').trim() || 'Unknown speaker'
}

export function getSpeakersFromQuotes(quotes) {
  const speakers = new Set()
  for (const quote of quotes) {
    for (const line of quote.lines || []) {
      const author = (line.author || '').trim()
      if (author) speakers.add(author)
    }
  }
  return [...speakers].sort((a, b) => a.localeCompare(b))
}

export function getSpeakerQuoteCounts(quotes) {
  const counts = {}

  for (const quote of quotes) {
    const speakersInQuote = new Set()
    for (const line of quote.lines || []) {
      const speaker = (line.author || '').trim() || 'Anonymous'
      speakersInQuote.add(speaker)
    }
    for (const speaker of speakersInQuote) {
      counts[speaker] = (counts[speaker] || 0) + 1
    }
  }

  return Object.entries(counts)
    .map(([speaker, count]) => ({ speaker, count }))
    .sort((a, b) => b.count - a.count || a.speaker.localeCompare(b.speaker))
}

export function quoteHasSpeaker(quote, speaker) {
  if (!speaker) return true
  return (quote.lines || []).some((line) => (line.author || '').trim() === speaker)
}

function quoteDateText(quote) {
  return [quote.month, quote.day_range, quote.year].filter(Boolean).join(' ')
}

function fieldSearchText(quote, field) {
  switch (field) {
    case 'quote':
      return (quote.lines || []).map((line) => line.quote).filter(Boolean)
    case 'context':
      return (quote.lines || []).map((line) => line.context).filter(Boolean)
    case 'date':
      return [quoteDateText(quote)].filter(Boolean)
    case 'added-by':
      return [quote.creator_name].filter(Boolean)
    default:
      return []
  }
}

export function quoteMatchesSearch(quote, query, field = 'quote') {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true

  const values = fieldSearchText(quote, field)
  return values.some((value) => value.toLowerCase().includes(normalized))
}

function getUserDateSortKey(quote) {
  const month = quote.month ? MONTH_INDEX[quote.month] || 0 : 0
  const dayMatch = quote.day_range?.match(/\d+/)
  const day = dayMatch ? Number(dayMatch[0]) : 0
  const year = quote.year || 0

  if (!year && !month && !day) return null
  return year * 10000 + month * 100 + day
}

function getDateSortKey(quote) {
  const userDate = getUserDateSortKey(quote)
  if (userDate !== null) return userDate
  return quote.created_at ? new Date(quote.created_at).getTime() : 0
}

function compareByDate(a, b, ascending) {
  const diff = getDateSortKey(a) - getDateSortKey(b)
  if (diff !== 0) return ascending ? diff : -diff
  return (a.id || 0) - (b.id || 0)
}

function compareBySpeaker(a, b, ascending) {
  const diff = getPrimarySpeaker(a).localeCompare(getPrimarySpeaker(b))
  if (diff !== 0) return ascending ? diff : -diff
  return compareByDate(a, b, false)
}

export function formatQuoteDate(quote) {
  const parts = [quote.month, quote.day_range, quote.year].filter(Boolean)
  return parts.length ? parts.join(' ') : null
}

export function filterAndSortQuotes(quotes, { sortBy, speaker, search, searchField }) {
  const filtered = quotes.filter(
    (quote) => quoteHasSpeaker(quote, speaker)
      && quoteMatchesSearch(quote, search, searchField),
  )

  const sorted = [...filtered]
  switch (sortBy) {
    case 'date-asc':
      sorted.sort((a, b) => compareByDate(a, b, true))
      break
    case 'speaker-asc':
      sorted.sort((a, b) => compareBySpeaker(a, b, true))
      break
    case 'speaker-desc':
      sorted.sort((a, b) => compareBySpeaker(a, b, false))
      break
    case 'date-desc':
    default:
      sorted.sort((a, b) => compareByDate(a, b, false))
      break
  }

  return sorted
}
