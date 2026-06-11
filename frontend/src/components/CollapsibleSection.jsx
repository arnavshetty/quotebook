import { ChevronDown } from 'lucide-react'

export default function CollapsibleSection({
  variant = 'sidebar',
  open,
  onToggle,
  title,
  hint,
  toggleLabel,
  toggleIcon,
  children,
  innerClassName = '',
  className = '',
}) {
  if (variant === 'panel') {
    return (
      <section className={`panel panel--collapsible${open ? ' is-open' : ''}${className ? ` ${className}` : ''}`}>
        <button
          type="button"
          className="panel-toggle"
          onClick={onToggle}
          aria-expanded={open}
        >
          <span className="panel-toggle-label">
            {toggleIcon}
            {toggleLabel}
          </span>
          <ChevronDown size={16} strokeWidth={2} className="panel-toggle-chevron" aria-hidden="true" />
        </button>
        <div className="collapsible-body">
          <div className={`collapsible-body-inner panel-body${innerClassName ? ` ${innerClassName}` : ''}`}>
            {children}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section
      className={`sidebar-section sidebar-section--collapsible${open ? '' : ' is-collapsed'}${className ? ` ${className}` : ''}`}
    >
      <button
        type="button"
        className="sidebar-section-toggle"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className="sidebar-section-toggle-text">
          <span className="sidebar-section-toggle-title">{title}</span>
          {hint && <span className="sidebar-section-toggle-hint">{hint}</span>}
        </span>
        <ChevronDown size={16} strokeWidth={2} className="sidebar-section-chevron" aria-hidden="true" />
      </button>
      <div className="collapsible-body">
        <div className={`collapsible-body-inner${innerClassName ? ` ${innerClassName}` : ''}`}>
          {children}
        </div>
      </div>
    </section>
  )
}
