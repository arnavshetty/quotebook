import { ChevronDown } from 'lucide-react'

export default function CollapsibleSection({
  variant = 'sidebar',
  open,
  onToggle,
  title,
  hint,
  headerAction = null,
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

  const hasHeaderAction = Boolean(headerAction)

  return (
    <section
      className={`sidebar-section sidebar-section--collapsible${open ? '' : ' is-collapsed'}${className ? ` ${className}` : ''}`}
    >
      <div className={`sidebar-section-header${hasHeaderAction ? ' sidebar-section-header--has-action' : ''}`}>
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
        </button>
        {hasHeaderAction && (
          <div className="sidebar-section-header-action">
            {headerAction}
          </div>
        )}
        <button
          type="button"
          className="sidebar-section-chevron-btn"
          onClick={onToggle}
          tabIndex={-1}
          aria-hidden="true"
        >
          <ChevronDown size={16} strokeWidth={2} className="sidebar-section-chevron" />
        </button>
      </div>
      <div className="collapsible-body">
        <div className="collapsible-body-inner">
          <div className={`collapsible-body-content${innerClassName ? ` ${innerClassName}` : ''}`}>
            {children}
          </div>
        </div>
      </div>
    </section>
  )
}
