export function formatQuoteForCopy(quote) {
  const lineTexts = (quote.lines || []).map((line) => {
    const speaker = line.author?.trim() || 'Anonymous'
    let text = `"${line.quote}" — ${speaker}`

    if (line.context?.trim()) {
      if (line.context_position === 'Before') {
        text = `[${line.context.trim()}] ${text}`
      } else if (line.context_position === 'After') {
        text = `${text} [${line.context.trim()}]`
      } else {
        text = `${text} (${line.context.trim()})`
      }
    }

    return text
  })

  const dateParts = [quote.month, quote.day_range, quote.year].filter(Boolean)
  const parts = [...lineTexts]

  if (dateParts.length) {
    parts.push(`(${dateParts.join(' ')})`)
  }

  return parts.join('\n')
}
