import { Check, Pencil, X } from 'lucide-react'

export default function InlineEditActions({
  editing,
  onEdit,
  onSave,
  onCancel,
  saving = false,
  saveDisabled = false,
  iconSize = 14,
  saveType = 'button',
  editLabel = 'Edit',
  saveLabel = 'Save changes',
  cancelLabel = 'Discard changes',
  showEditPlaceholder = false,
}) {
  if (editing) {
    if (showEditPlaceholder) {
      return <span className="inline-header-actions-spacer" aria-hidden="true" />
    }

    return (
      <>
        <button
          type={saveType}
          className="icon-action-btn icon-action-btn--confirm"
          onClick={saveType === 'button' ? onSave : undefined}
          disabled={saving || saveDisabled}
          aria-label={saveLabel}
        >
          <Check size={iconSize} strokeWidth={2} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="icon-action-btn icon-action-btn--discard"
          onClick={onCancel}
          disabled={saving}
          aria-label={cancelLabel}
        >
          <X size={iconSize} strokeWidth={2} aria-hidden="true" />
        </button>
      </>
    )
  }

  if (!onEdit) return null

  return (
    <button
      type="button"
      className="icon-action-btn"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onEdit}
      aria-label={editLabel}
    >
      <Pencil size={iconSize} strokeWidth={2} aria-hidden="true" />
    </button>
  )
}
