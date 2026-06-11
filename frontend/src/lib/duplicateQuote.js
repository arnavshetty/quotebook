function normalizeLine(line) {
  return {
    quote: (line.quote || '').trim(),
    author: (line.author || '').trim(),
    context: (line.context || '').trim(),
    context_position: (line.context_position || '').trim(),
  }
}

export function normalizeQuotePayload({ month, day_range, year, lines }) {
  return {
    month: (month || '').trim(),
    day_range: (day_range || '').trim(),
    year: year != null && year !== '' ? String(year).trim() : '',
    lines: (lines || [])
      .map(normalizeLine)
      .filter((line) => line.quote),
  }
}

export function normalizeStoredQuote(quote) {
  return normalizeQuotePayload({
    month: quote.month,
    day_range: quote.day_range,
    year: quote.year,
    lines: quote.lines,
  })
}

export function quotePayloadsMatch(a, b) {
  if (a.month !== b.month || a.day_range !== b.day_range || a.year !== b.year) return false
  if (a.lines.length !== b.lines.length) return false

  return a.lines.every((line, index) => {
    const other = b.lines[index]
    return line.quote === other.quote
      && line.author === other.author
      && line.context === other.context
      && line.context_position === other.context_position
  })
}

export function findExactDuplicate(quotes, payload) {
  const normalized = normalizeQuotePayload(payload)
  return quotes.find((quote) => quotePayloadsMatch(normalized, normalizeStoredQuote(quote))) || null
}
