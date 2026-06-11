import { useState } from 'react'
import { getLineSpeakerStyle } from '../lib/speakerColors'

const EMPTY_LINE = { quote: '', author: '', context: '', context_position: '' }

const MONTHS = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function toFormLines(lines) {
  if (!lines?.length) return [{ ...EMPTY_LINE }]
  return lines.map((line) => ({
    quote: line.quote || '',
    author: line.author || '',
    context: line.context || '',
    context_position: line.context_position || '',
  }))
}

export default function QuoteForm({
  onSubmit,
  submitting,
  initialValues,
  onCancel,
  submitLabel = 'Add quote',
  idPrefix = '',
  resetAfterSubmit = false,
  speakerColorMap,
}) {
  const fieldId = (name) => (idPrefix ? `${idPrefix}-${name}` : name)

  const [lines, setLines] = useState(() => toFormLines(initialValues?.lines))
  const [month, setMonth] = useState(initialValues?.month || '')
  const [dayRange, setDayRange] = useState(initialValues?.day_range || '')
  const [year, setYear] = useState(
    initialValues?.year != null && initialValues?.year !== ''
      ? String(initialValues.year)
      : '',
  )

  const resetForm = () => {
    setLines([{ ...EMPTY_LINE }])
    setMonth('')
    setDayRange('')
    setYear('')
  }

  const updateLine = (index, field, value) => {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, [field]: value } : line)))
  }

  const addLine = () => setLines((prev) => [...prev, { ...EMPTY_LINE }])

  const removeLine = (index) => {
    if (lines.length <= 1) return
    setLines((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    try {
      await onSubmit({
        month: month || null,
        day_range: dayRange || null,
        year: year || null,
        lines,
      })
      if (resetAfterSubmit) resetForm()
    } catch {
      // Parent handles errors; keep form state on failure.
    }
  }

  return (
    <form className="quote-form" onSubmit={handleSubmit}>
      {lines.map((line, index) => (
        <div
          key={index}
          className={`line-row${speakerColorMap ? ' speaker-bordered' : ''}`}
          style={speakerColorMap ? getLineSpeakerStyle(line, speakerColorMap) : undefined}
        >
          {lines.length > 1 && (
            <div className="line-row-header">
              <span className="line-row-label">Line {index + 1}</span>
              <button
                type="button"
                className="text-btn text-btn--danger"
                onClick={() => removeLine(index)}
              >
                Remove line
              </button>
            </div>
          )}
          <div className="form-group">
            <label htmlFor={fieldId(`quote-${index}`)}>Quote</label>
            <input
              id={fieldId(`quote-${index}`)}
              value={line.quote}
              onChange={(e) => updateLine(index, 'quote', e.target.value)}
              placeholder="To be or not to be..."
              required={index === 0}
            />
          </div>
          <div className="flex-group">
            <div className="form-group">
              <label htmlFor={fieldId(`author-${index}`)}>Speaker</label>
              <input
                id={fieldId(`author-${index}`)}
                value={line.author}
                onChange={(e) => updateLine(index, 'author', e.target.value)}
                placeholder="Hamlet"
              />
            </div>
            <div className="form-group context-group">
              <label htmlFor={fieldId(`context-${index}`)}>Context</label>
              <input
                id={fieldId(`context-${index}`)}
                value={line.context}
                onChange={(e) => updateLine(index, 'context', e.target.value)}
                placeholder="monologuing to the audience"
              />
            </div>
            <div className="form-group">
              <label htmlFor={fieldId(`position-${index}`)}>Context position</label>
              <select
                id={fieldId(`position-${index}`)}
                value={line.context_position}
                onChange={(e) => updateLine(index, 'context_position', e.target.value)}
              >
                <option value="">N/A</option>
                <option value="Before">Before</option>
                <option value="After">After</option>
              </select>
            </div>
          </div>
        </div>
      ))}

      <button type="button" className="secondary-btn" onClick={addLine}>
        Add speaker line
      </button>

      <div className="flex-group">
        <div className="form-group">
          <label htmlFor={fieldId('month')}>Month</label>
          <select id={fieldId('month')} value={month} onChange={(e) => setMonth(e.target.value)}>
            {MONTHS.map((m) => (
              <option key={m || 'na'} value={m}>{m || 'N/A'}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor={fieldId('day-range')}>Day(s)</label>
          <input
            id={fieldId('day-range')}
            value={dayRange}
            onChange={(e) => setDayRange(e.target.value)}
            placeholder="DD or DD-DD"
          />
        </div>
        <div className="form-group">
          <label htmlFor={fieldId('year')}>Year</label>
          <input
            id={fieldId('year')}
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="YYYY"
          />
        </div>
      </div>

      <div className="quote-form-actions">
        <button type="submit" disabled={submitting}>
          {submitting ? 'Saving...' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="secondary-btn" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
