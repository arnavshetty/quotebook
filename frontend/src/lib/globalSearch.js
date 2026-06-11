import { QUOTE_SEARCH_FIELD_VALUES } from './searchFields'
import { formatQuoteDate, getPrimarySpeaker, quoteMatchesSearch } from './quoteSort'

export function quoteMatchesGlobalSearch(quote, query) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return false

  if (getPrimarySpeaker(quote).toLowerCase().includes(normalized)) return true

  return QUOTE_SEARCH_FIELD_VALUES.some((field) => quoteMatchesSearch(quote, query, field))
}

export function searchQuotes(quotes, query) {
  const normalized = query.trim()
  if (!normalized) return []

  return quotes.filter((quote) => quoteMatchesGlobalSearch(quote, normalized))
}

export function getQuoteSearchSnippet(quote, query, maxLength = 120) {
  const normalized = query.trim().toLowerCase()
  const lines = quote.lines || []
  const primaryLine = lines.find((line) => line.quote?.trim()) || lines[0]
  const text = primaryLine?.quote?.trim() || ''

  if (!text) return 'Quote'
  if (!normalized) {
    return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text
  }

  const lower = text.toLowerCase()
  const matchIndex = lower.indexOf(normalized)
  if (matchIndex === -1) {
    return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text
  }

  const start = Math.max(0, matchIndex - 30)
  const end = Math.min(text.length, matchIndex + normalized.length + 50)
  let snippet = text.slice(start, end)
  if (start > 0) snippet = `…${snippet}`
  if (end < text.length) snippet = `${snippet}…`
  return snippet
}

export function formatSearchResultMeta(quote) {
  const date = formatQuoteDate(quote)
  const speaker = getPrimarySpeaker(quote)
  return [speaker, date].filter(Boolean).join(' · ')
}
