export const MONTHS = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export const MONTH_INDEX = {
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

export function getUserDateSortKey(quote) {
  const month = quote.month ? MONTH_INDEX[quote.month] || 0 : 0
  const dayMatch = quote.day_range?.match(/\d+/)
  const day = dayMatch ? Number(dayMatch[0]) : 0
  const year = quote.year || 0

  if (!year && !month && !day) return null
  return year * 10000 + month * 100 + day
}

export function formatQuoteDate(quote) {
  const parts = [quote.month, quote.day_range, quote.year].filter(Boolean)
  return parts.length ? parts.join(' ') : null
}
