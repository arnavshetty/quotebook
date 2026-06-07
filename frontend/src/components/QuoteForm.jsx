import { useState } from 'react'

const EMPTY_LINE = { quote: '', author: '', context: '', context_position: '' }

const MONTHS = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function QuoteForm({ onSubmit, submitting }) {
  const [lines, setLines] = useState([{ ...EMPTY_LINE }])
  const [month, setMonth] = useState('')
  const [dayRange, setDayRange] = useState('')
  const [year, setYear] = useState('')

  const updateLine = (index, field, value) => {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, [field]: value } : line)))
  }

  const addLine = () => setLines((prev) => [...prev, { ...EMPTY_LINE }])

  const handleSubmit = (event) => {
    event.preventDefault()
    onSubmit({
      month: month || null,
      day_range: dayRange || null,
      year: year || null,
      lines,
    })
  }

  return (
    <form className="quote-form" onSubmit={handleSubmit}>
      {lines.map((line, index) => (
        <div key={index} className="line-row">
          <div className="form-group">
            <label htmlFor={`quote-${index}`}>Quote</label>
            <input
              id={`quote-${index}`}
              value={line.quote}
              onChange={(e) => updateLine(index, 'quote', e.target.value)}
              placeholder="To be or not to be..."
              required={index === 0}
            />
          </div>
          <div className="flex-group">
            <div className="form-group">
              <label htmlFor={`author-${index}`}>Speaker</label>
              <input
                id={`author-${index}`}
                value={line.author}
                onChange={(e) => updateLine(index, 'author', e.target.value)}
                placeholder="Hamlet"
              />
            </div>
            <div className="form-group context-group">
              <label htmlFor={`context-${index}`}>Context</label>
              <input
                id={`context-${index}`}
                value={line.context}
                onChange={(e) => updateLine(index, 'context', e.target.value)}
                placeholder="monologuing to the audience"
              />
            </div>
            <div className="form-group">
              <label htmlFor={`position-${index}`}>Context position</label>
              <select
                id={`position-${index}`}
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
          <label htmlFor="month">Month</label>
          <select id="month" value={month} onChange={(e) => setMonth(e.target.value)}>
            {MONTHS.map((m) => (
              <option key={m || 'na'} value={m}>{m || 'N/A'}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="day-range">Day(s)</label>
          <input
            id="day-range"
            value={dayRange}
            onChange={(e) => setDayRange(e.target.value)}
            placeholder="DD or DD-DD"
          />
        </div>
        <div className="form-group">
          <label htmlFor="year">Year</label>
          <input
            id="year"
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="YYYY"
          />
        </div>
      </div>

      <button type="submit" disabled={submitting}>
        {submitting ? 'Saving...' : 'Add quote'}
      </button>
    </form>
  )
}
