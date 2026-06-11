import { formatLineText } from './quoteLine'

export function formatQuoteForCopy(quote) {
  const lineTexts = (quote.lines || []).map((line) => formatLineText(line, 'plain'))
  const dateParts = [quote.month, quote.day_range, quote.year].filter(Boolean)
  const parts = [...lineTexts]

  if (dateParts.length) {
    parts.push(`(${dateParts.join(' ')})`)
  }

  return parts.join('\n')
}
