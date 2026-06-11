import { Search, X } from 'lucide-react'
import { QUOTE_SEARCH_FIELDS, getSearchFieldPlaceholder } from '../lib/searchFields'

export default function SearchInput({
  variant = 'dashboard',
  value,
  onChange,
  onClear,
  id,
  label,
  placeholder,
  ariaLabel = 'Search',
  field,
  onFieldChange,
}) {
  if (variant === 'toolbar') {
    const resolvedPlaceholder = placeholder || getSearchFieldPlaceholder(field)

    return (
      <div className="search-bar">
        <select
          className="search-bar-field"
          value={field}
          onChange={(event) => onFieldChange(event.target.value)}
          aria-label="Search in"
        >
          {QUOTE_SEARCH_FIELDS.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
        <div className="search-bar-input-wrap">
          <input
            type="text"
            className="search-bar-input"
            value={value}
            onChange={onChange}
            placeholder={resolvedPlaceholder}
            aria-label={ariaLabel}
          />
          {value && (
            <button
              type="button"
              className="icon-action-btn icon-action-btn--discard search-bar-clear"
              onClick={onClear}
              aria-label="Clear search"
            >
              <X size={14} strokeWidth={2} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <section className="dashboard-search">
      {label && (
        <label className="dashboard-search-label" htmlFor={id}>
          {label}
        </label>
      )}
      <div className="dashboard-search-bar">
        <Search size={16} strokeWidth={2} className="dashboard-search-icon" aria-hidden="true" />
        <input
          id={id}
          type="search"
          className="dashboard-search-input"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          aria-label={ariaLabel}
        />
        {value && (
          <button
            type="button"
            className="icon-action-btn icon-action-btn--discard dashboard-search-clear"
            onClick={onClear}
            aria-label="Clear search"
          >
            <X size={14} strokeWidth={2} aria-hidden="true" />
          </button>
        )}
      </div>
    </section>
  )
}
