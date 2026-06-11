export const QUOTE_SEARCH_FIELDS = [
  { value: 'quote', label: 'Quote', placeholder: 'Search quote text…' },
  { value: 'context', label: 'Context', placeholder: 'Search context…' },
  { value: 'date', label: 'Date', placeholder: 'e.g. June 2024' },
  { value: 'added-by', label: 'Added by', placeholder: 'Search who added it…' },
]

export const QUOTE_SEARCH_FIELD_VALUES = QUOTE_SEARCH_FIELDS.map((field) => field.value)

export function getSearchFieldPlaceholder(field) {
  return QUOTE_SEARCH_FIELDS.find((item) => item.value === field)?.placeholder
    || 'Search…'
}
