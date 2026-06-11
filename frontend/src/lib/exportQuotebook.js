import { sortQuotesForBookView } from './bookLayout'
import { formatQuoteForCopy } from './formatQuote'
import { formatQuoteDate, getPrimarySpeaker } from './quoteSort'

function slugifyFilename(title) {
  const slug = (title || 'quotebook')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'quotebook'
}

function getSortedQuotes(quotes, bookSort) {
  return sortQuotesForBookView(quotes, bookSort)
}

function formatLineMarkdown(line) {
  const speaker = line.author?.trim() || 'Anonymous'
  let text = `> “${line.quote}” — *${speaker}*`

  if (line.context?.trim()) {
    if (line.context_position === 'Before') {
      text = `> [${line.context.trim()}] “${line.quote}” — *${speaker}*`
    } else if (line.context_position === 'After') {
      text = `> “${line.quote}” — *${speaker}* [${line.context.trim()}]`
    } else {
      text = `> “${line.quote}” — *${speaker}* (${line.context.trim()})`
    }
  }

  return text
}

export function exportQuotebookPlainText(quotes, quotebook, bookSort = 'date') {
  const sorted = getSortedQuotes(quotes, bookSort)
  const header = [
    quotebook.title,
    quotebook.description || null,
    sorted.length ? `${sorted.length} quote${sorted.length === 1 ? '' : 's'}` : null,
    '',
  ].filter((line) => line !== null)

  const body = sorted.flatMap((quote) => [formatQuoteForCopy(quote), ''])
  return [...header, ...body].join('\n').trim()
}

export function exportQuotebookMarkdown(quotes, quotebook, bookSort = 'date') {
  const sorted = getSortedQuotes(quotes, bookSort)
  const lines = [`# ${quotebook.title}`]

  if (quotebook.description?.trim()) {
    lines.push('', quotebook.description.trim())
  }

  lines.push('', `_${sorted.length} quote${sorted.length === 1 ? '' : 's'}_`, '')

  sorted.forEach((quote) => {
    const date = formatQuoteDate(quote)
    const speaker = getPrimarySpeaker(quote)
    lines.push(`## ${speaker}${date ? ` · ${date}` : ''}`)
    ;(quote.lines || []).forEach((line) => {
      lines.push(formatLineMarkdown(line))
    })
    lines.push('')
  })

  return lines.join('\n').trim()
}

export function exportQuotebookJson(quotes, quotebook, bookSort = 'date') {
  const sorted = getSortedQuotes(quotes, bookSort)
  return JSON.stringify(
    {
      title: quotebook.title,
      description: quotebook.description || null,
      exported_at: new Date().toISOString(),
      sort: bookSort,
      quote_count: sorted.length,
      quotes: sorted,
    },
    null,
    2,
  )
}

export function downloadTextFile(content, filename) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function downloadQuotebookExport(quotes, quotebook, format, bookSort = 'date') {
  const base = slugifyFilename(quotebook.title)
  let content = ''
  let filename = `${base}.txt`

  if (format === 'markdown') {
    content = exportQuotebookMarkdown(quotes, quotebook, bookSort)
    filename = `${base}.md`
  } else if (format === 'json') {
    content = exportQuotebookJson(quotes, quotebook, bookSort)
    filename = `${base}.json`
  } else {
    content = exportQuotebookPlainText(quotes, quotebook, bookSort)
  }

  downloadTextFile(content, filename)
}
