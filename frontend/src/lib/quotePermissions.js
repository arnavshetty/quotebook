export function canModerateQuote(quote, quotebook, userId) {
  if (!quote || !quotebook || !userId) return false
  if (quote.user_id === userId) return true
  return ['owner', 'admin', 'contributor'].includes(quotebook.user_role)
}

export function canManageCollaborators(quotebook) {
  return quotebook && (quotebook.user_role === 'owner' || quotebook.user_role === 'admin')
}

export function canAddQuotes(quotebook) {
  return quotebook && ['owner', 'contributor', 'admin'].includes(quotebook.user_role)
}

export function isQuotebookOwner(quotebook) {
  return quotebook?.user_role === 'owner'
}

export function canLeaveQuotebook(quotebook) {
  return quotebook && quotebook.user_role !== 'owner'
}

export function canRenameSpeakers(quotebook) {
  return quotebook?.user_role === 'owner' || quotebook?.user_role === 'admin'
}
