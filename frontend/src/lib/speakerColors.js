import { ANONYMOUS_SPEAKER } from './quoteSort'

export const SPEAKER_BORDER_COLORS = [
  '#c0392b',
  '#1e8449',
  '#d35400',
  '#7d3c98',
  '#2471a3',
  '#b7950b',
  '#117a65',
  '#c2185b',
  '#512da8',
  '#558b2f',
]

const FALLBACK_COLOR = '#78716c'

export function getLineSpeaker(line) {
  return (line?.author || '').trim() || ANONYMOUS_SPEAKER
}

export function buildSpeakerColorMap(speakers) {
  const map = {}
  speakers.forEach((speaker, index) => {
    map[speaker] = SPEAKER_BORDER_COLORS[index % SPEAKER_BORDER_COLORS.length]
  })
  return map
}

export function getSpeakerBorderColor(speaker, colorMap) {
  if (!speaker) return FALLBACK_COLOR
  if (colorMap[speaker]) return colorMap[speaker]

  let hash = 0
  for (let i = 0; i < speaker.length; i += 1) {
    hash = speaker.charCodeAt(i) + ((hash << 5) - hash)
  }
  return SPEAKER_BORDER_COLORS[Math.abs(hash) % SPEAKER_BORDER_COLORS.length]
}

export function getLineSpeakerStyle(line, colorMap) {
  const speaker = getLineSpeaker(line)
  const color = getSpeakerBorderColor(speaker, colorMap)
  return { '--quote-speaker-color': color }
}
