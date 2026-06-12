import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

export default function RoleBadgeSelect({
  id,
  value,
  onChange,
  options = ['viewer', 'contributor', 'admin'],
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const selectRole = (role) => {
    onChange(role)
    setOpen(false)
  }

  return (
    <div className="role-badge-select" ref={rootRef}>
      <button
        type="button"
        id={id}
        className="role-badge-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((isOpen) => !isOpen)}
      >
        <span className={`badge badge--${value}`}>{value}</span>
        <ChevronDown size={16} strokeWidth={2} className="role-badge-select-chevron" aria-hidden="true" />
      </button>
      {open && (
        <ul className="role-badge-select-menu" role="listbox" aria-labelledby={id}>
          {options.map((role) => (
            <li key={role} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={role === value}
                className="role-badge-select-option"
                onClick={() => selectRole(role)}
              >
                <span className={`badge badge--${role}`}>{role}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
