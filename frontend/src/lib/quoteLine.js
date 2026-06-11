import { getLineSpeaker } from './speakerColors'

export function formatLineText(line, format = 'plain') {
  const speaker = getLineSpeaker(line)
  const quote = line.quote || ''
  const context = line.context?.trim()

  if (format === 'markdown') {
    let text = `> “${quote}” — *${speaker}*`
    if (context) {
      if (line.context_position === 'Before') {
        text = `> [${context}] “${quote}” — *${speaker}*`
      } else if (line.context_position === 'After') {
        text = `> “${quote}” — *${speaker}* [${context}]`
      } else {
        text = `> “${quote}” — *${speaker}* (${context})`
      }
    }
    return text
  }

  let text = `"${quote}" — ${speaker}`
  if (context) {
    if (line.context_position === 'Before') {
      text = `[${context}] ${text}`
    } else if (line.context_position === 'After') {
      text = `${text} [${context}]`
    } else {
      text = `${text} (${context})`
    }
  }
  return text
}
