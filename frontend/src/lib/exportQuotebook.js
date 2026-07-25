import { sortQuotesForBookView } from './bookLayout'
import { formatQuoteForCopy } from './formatQuote'
import { formatLineText } from './quoteLine'
import { pluralize } from './strings'
import { formatQuoteDate, getPrimarySpeaker } from './quoteSort'

function slugifyFilename(title) {
  const slug = (title || 'quotebook')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'quotebook'
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function getSortedQuotes(quotes, bookSort) {
  return sortQuotesForBookView(quotes, bookSort)
}

export function exportQuotebookPlainText(quotes, quotebook, bookSort = 'date') {
  const sorted = getSortedQuotes(quotes, bookSort)
  const header = [
    quotebook.title,
    quotebook.description || null,
    sorted.length ? pluralize(sorted.length, 'quote') : null,
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

  lines.push('', `_${pluralize(sorted.length, 'quote')}_`, '')

  sorted.forEach((quote) => {
    const date = formatQuoteDate(quote)
    const speaker = getPrimarySpeaker(quote)
    lines.push(`## ${speaker}${date ? ` · ${date}` : ''}`)
    ;(quote.lines || []).forEach((line) => {
      lines.push(formatLineText(line, 'markdown'))
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

function buildPrintHtml(quotes, quotebook, bookSort = 'date') {
  const sorted = getSortedQuotes(quotes, bookSort)
  const title = escapeHtml(quotebook.title || 'Quotebook')
  const description = quotebook.description?.trim()
    ? `<p class="description">${escapeHtml(quotebook.description.trim())}</p>`
    : ''

  const quoteHtml = sorted.map((quote) => {
    const date = formatQuoteDate(quote)
    const speaker = escapeHtml(getPrimarySpeaker(quote))
    const meta = date
      ? `<p class="meta">${speaker} · ${escapeHtml(date)}</p>`
      : `<p class="meta">${speaker}</p>`
    const lines = (quote.lines || []).map((line) => {
      const text = escapeHtml(line.quote || '')
      const lineSpeaker = escapeHtml(line.speaker || getPrimarySpeaker(quote))
      const context = line.context?.trim()
      let contextHtml = ''
      if (context) {
        const safe = escapeHtml(context)
        if (line.context_position === 'Before') {
          contextHtml = `<span class="context">[${safe}]</span> `
        } else if (line.context_position === 'After') {
          contextHtml = ` <span class="context">[${safe}]</span>`
        } else {
          contextHtml = ` <span class="context">(${safe})</span>`
        }
      }
      const before = line.context_position === 'Before' ? contextHtml : ''
      const after = line.context_position === 'Before' ? '' : contextHtml
      return `<p class="line">${before}<span class="line-quote">“${text}”</span> — <span class="speaker">${lineSpeaker}</span>${after}</p>`
    }).join('')

    return `<article class="quote-block">${meta}${lines}</article>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    @page { margin: 0.75in; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #1a1612;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 11pt;
      line-height: 1.55;
      background: #fff;
    }
    h1 {
      margin: 0 0 0.35rem;
      font-family: Georgia, "Times New Roman", serif;
      font-size: 28pt;
      font-weight: 600;
      color: #8b3a2a;
      line-height: 1.15;
    }
    .description {
      margin: 0 0 0.5rem;
      color: #6b635a;
    }
    .count {
      margin: 0 0 1.5rem;
      color: #9c9288;
      font-size: 10pt;
    }
    .quote-block {
      break-inside: avoid;
      margin: 0 0 1.25rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #e3dbd0;
    }
    .quote-block:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }
    .meta {
      margin: 0 0 0.4rem;
      font-size: 10pt;
      font-weight: 600;
      color: #6b635a;
      letter-spacing: 0.02em;
    }
    .line {
      margin: 0 0 0.35rem;
      font-family: Georgia, "Times New Roman", serif;
      font-size: 13pt;
      line-height: 1.45;
    }
    .line-quote { font-style: italic; }
    .speaker { font-style: normal; font-family: system-ui, sans-serif; font-size: 11pt; font-weight: 600; color: #6b635a; }
    .context { font-style: normal; font-family: system-ui, sans-serif; font-size: 10pt; color: #9c9288; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${description}
  <p class="count">${escapeHtml(pluralize(sorted.length, 'quote'))}</p>
  ${quoteHtml}
</body>
</html>`
}

export function printQuotebook(quotes, quotebook, bookSort = 'date') {
  const html = buildPrintHtml(quotes, quotebook, bookSort)
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.position = 'fixed'
  frame.style.right = '0'
  frame.style.bottom = '0'
  frame.style.width = '0'
  frame.style.height = '0'
  frame.style.border = '0'
  document.body.appendChild(frame)

  const frameWindow = frame.contentWindow
  const frameDoc = frame.contentDocument || frameWindow?.document
  if (!frameWindow || !frameDoc) {
    document.body.removeChild(frame)
    throw new Error('Unable to open print preview.')
  }

  frameDoc.open()
  frameDoc.write(html)
  frameDoc.close()

  const cleanup = () => {
    if (frame.parentNode) {
      frame.parentNode.removeChild(frame)
    }
  }

  const triggerPrint = () => {
    try {
      frameWindow.focus()
      frameWindow.print()
    } finally {
      window.setTimeout(cleanup, 1000)
    }
  }

  if (frameDoc.readyState === 'complete') {
    triggerPrint()
  } else {
    frame.onload = triggerPrint
    window.setTimeout(triggerPrint, 250)
  }
}

export async function downloadQuotebookPdf(quotes, quotebook, bookSort = 'date') {
  const { jsPDF } = await import('jspdf')
  const sorted = getSortedQuotes(quotes, bookSort)
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const marginX = 56
  const marginTop = 56
  const marginBottom = 56
  const contentWidth = pageWidth - marginX * 2
  let y = marginTop

  const ensureSpace = (needed) => {
    if (y + needed <= pageHeight - marginBottom) return
    doc.addPage()
    y = marginTop
  }

  const writeWrapped = (text, { size = 11, font = 'helvetica', style = 'normal', color = [26, 22, 18], gap = 6 } = {}) => {
    doc.setFont(font, style)
    doc.setFontSize(size)
    doc.setTextColor(...color)
    const lines = doc.splitTextToSize(text, contentWidth)
    const lineHeight = size * 1.35
    ensureSpace(lines.length * lineHeight)
    doc.text(lines, marginX, y)
    y += lines.length * lineHeight + gap
  }

  writeWrapped(quotebook.title || 'Quotebook', {
    size: 22,
    style: 'bold',
    color: [139, 58, 42],
    gap: 8,
  })

  if (quotebook.description?.trim()) {
    writeWrapped(quotebook.description.trim(), {
      size: 11,
      color: [107, 99, 90],
      gap: 6,
    })
  }

  writeWrapped(pluralize(sorted.length, 'quote'), {
    size: 10,
    color: [156, 146, 136],
    gap: 18,
  })

  sorted.forEach((quote, index) => {
    const date = formatQuoteDate(quote)
    const speaker = getPrimarySpeaker(quote)
    const heading = date ? `${speaker} · ${date}` : speaker

    ensureSpace(40)
    writeWrapped(heading, {
      size: 11,
      style: 'bold',
      color: [107, 99, 90],
      gap: 4,
    })

    ;(quote.lines || []).forEach((line) => {
      writeWrapped(formatLineText(line, 'plain'), {
        size: 12,
        color: [26, 22, 18],
        gap: 4,
      })
    })

    if (index < sorted.length - 1) {
      y += 8
      ensureSpace(12)
      doc.setDrawColor(227, 219, 208)
      doc.setLineWidth(0.75)
      doc.line(marginX, y, pageWidth - marginX, y)
      y += 16
    }
  })

  doc.save(`${slugifyFilename(quotebook.title)}.pdf`)
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

export async function downloadQuotebookExport(quotes, quotebook, format, bookSort = 'date') {
  if (format === 'print') {
    printQuotebook(quotes, quotebook, bookSort)
    return
  }

  if (format === 'pdf') {
    await downloadQuotebookPdf(quotes, quotebook, bookSort)
    return
  }

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
