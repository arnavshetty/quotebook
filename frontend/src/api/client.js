import { normalizeQuoteLines } from '../lib/duplicateQuote'
import { supabase } from '../lib/supabase'

const QUOTE_BLOCK_SELECT = `
  id,
  user_id,
  quotebook_id,
  month,
  day_range,
  year,
  created_at,
  profiles!quote_blocks_user_id_fkey ( username ),
  utterances (
    quote,
    author,
    context,
    context_position,
    line_order
  )
`

async function fetchQuoteBlocks({ quotebookId, includeQuotebookTitle = false } = {}) {
  const select = includeQuotebookTitle
    ? QUOTE_BLOCK_SELECT.replace(
      'profiles!quote_blocks_user_id_fkey ( username ),',
      `profiles!quote_blocks_user_id_fkey ( username ),
        quotebooks!inner ( id, title ),`,
    )
    : QUOTE_BLOCK_SELECT

  let query = supabase
    .from('quote_blocks')
    .select(select)
    .order('created_at', { ascending: false })
    .order('line_order', { foreignTable: 'utterances', ascending: true })

  if (quotebookId != null) {
    query = query.eq('quotebook_id', quotebookId)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return (data || []).map((block) => {
    const quote = formatQuoteBlock(block)
    if (!includeQuotebookTitle) return quote
    return {
      ...quote,
      quotebook_id: block.quotebook_id,
      quotebook_title: block.quotebooks?.title || 'Quotebook',
    }
  })
}

async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', userId)
    .single()

  if (error) throw new Error(error.message)
  return data
}

function usernameFromAuthUser(authUser) {
  const meta = authUser.user_metadata || {}
  return (
    meta.username
    || meta.user_name
    || meta.preferred_username
    || meta.full_name
    || meta.name
    || authUser.email?.split('@')[0]
    || 'User'
  )
}

async function toAppUser(authUser) {
  if (!authUser) return null

  try {
    const profile = await getProfile(authUser.id)
    return {
      id: authUser.id,
      email: authUser.email,
      username: profile.username,
    }
  } catch {
    return {
      id: authUser.id,
      email: authUser.email,
      username: usernameFromAuthUser(authUser),
    }
  }
}

function formatQuoteBlock(block) {
  const profile = block.profiles || {}
  return {
    id: block.id,
    user_id: block.user_id,
    quotebook_id: block.quotebook_id,
    month: block.month,
    day_range: block.day_range,
    year: block.year,
    created_at: block.created_at,
    creator_name: profile.username || null,
    lines: (block.utterances || []).sort((a, b) => a.line_order - b.line_order),
  }
}

export const api = {
  signup: async ({ username, email, password }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    })

    if (error) throw new Error(error.message)
    return { user: data.user, session: data.session }
  },

  login: async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
    return { user: await toAppUser(data.user) }
  },

  resetPassword: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) throw new Error(error.message)
    return { message: 'If that email is registered, a reset link is on its way.' }
  },

  updatePassword: async (password) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw new Error(error.message)
    await supabase.auth.signOut()
    return { message: 'Password updated.' }
  },

  logout: async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw new Error(error.message)
  },

  me: async () => {
    const { data, error } = await supabase.auth.getUser()
    if (error) throw new Error(error.message)
    if (!data.user) return { user: null }
    return { user: await toAppUser(data.user) }
  },

  getQuotebooks: async () => {
    const { data, error } = await supabase.rpc('get_accessible_quotebooks')
    if (error) throw new Error(error.message)
    return { quotebooks: data || [] }
  },

  createQuotebook: async ({ title, description }) => {
    const { error } = await supabase.rpc('create_quotebook', {
      p_title: title.trim(),
      p_description: description?.trim() || null,
    })

    if (error) throw new Error(error.message)
    return api.getQuotebooks()
  },

  deleteQuotebook: async (quotebookId) => {
    const { error } = await supabase.from('quotebooks').delete().eq('id', quotebookId)
    if (error) throw new Error(error.message)
    return { message: 'Quotebook deleted.' }
  },

  getQuotebook: async (quotebookId) => {
    const { data, error } = await supabase
      .rpc('get_quotebook_for_user', { p_quotebook_id: quotebookId })

    if (error) throw new Error(error.message)
    if (!data?.length) throw new Error('Quotebook not found or access denied.')
    return { quotebook: data[0] }
  },

  getAllAccessibleQuotes: async () => ({
    quotes: await fetchQuoteBlocks({ includeQuotebookTitle: true }),
  }),

  getQuotes: async (quotebookId) => ({
    quotes: await fetchQuoteBlocks({ quotebookId }),
  }),

  addQuote: async (quotebookId, { month, day_range, year, lines }) => {
    const payload = normalizeQuoteLines(lines)

    const { error } = await supabase.rpc('add_quote_entry', {
      p_quotebook_id: quotebookId,
      p_month: month || '',
      p_day_range: day_range || '',
      p_year: year ? Number(year) : null,
      p_lines: payload,
    })

    if (error) throw new Error(error.message)
    return api.getQuotes(quotebookId)
  },

  updateQuotebook: async (quotebookId, { title, description }) => {
    const { data, error } = await supabase
      .from('quotebooks')
      .update({
        title: title.trim(),
        description: description?.trim() || null,
      })
      .eq('id', quotebookId)
      .select('id, title, description, created_by, created_at')
      .single()

    if (error) throw new Error(error.message)
    return { quotebook: data }
  },

  getCollaborators: async (quotebookId) => {
    const { data, error } = await supabase.rpc('get_quotebook_collaborators', {
      p_quotebook_id: quotebookId,
    })

    if (error) throw new Error(error.message)
    return { collaborators: data || [] }
  },

  updateCollaboratorRole: async (quotebookId, { userId = null, email = null, role }) => {
    const { error } = await supabase.rpc('update_quotebook_collaborator_role', {
      p_quotebook_id: quotebookId,
      p_user_id: userId,
      p_role: role,
      p_email: email,
    })

    if (error) throw new Error(error.message)
    return { message: 'Role updated.' }
  },

  removeCollaborator: async (quotebookId, { userId = null, email = null }) => {
    const { error } = await supabase.rpc('remove_quotebook_collaborator', {
      p_quotebook_id: quotebookId,
      p_user_id: userId,
      p_email: email,
    })

    if (error) throw new Error(error.message)
    return { message: userId ? 'Collaborator removed.' : 'Invite cancelled.' }
  },

  leaveQuotebook: async (quotebookId) => {
    const { error } = await supabase.rpc('leave_quotebook', {
      p_quotebook_id: quotebookId,
    })

    if (error) throw new Error(error.message)
    return { message: 'Left quotebook.' }
  },

  renameSpeaker: async (quotebookId, oldName, newName) => {
    const { data, error } = await supabase.rpc('rename_speaker_in_quotebook', {
      p_quotebook_id: quotebookId,
      p_old_name: oldName,
      p_new_name: newName,
    })

    if (error) throw new Error(error.message)
    return { updatedCount: data || 0 }
  },

  shareQuotebook: async (quotebookId, { email, role }) => {
    const { data, error } = await supabase.rpc('share_quotebook_with_email', {
      p_quotebook_id: quotebookId,
      p_friend_email: email,
      p_role: role,
    })

    if (error) throw new Error(error.message)

    if (data === 'invited') {
      return {
        status: 'invited',
        message: `Invite saved for ${email}. They'll get access when they sign up.`,
      }
    }

    return {
      status: 'shared',
      message: `Shared with ${email}.`,
    }
  },

  updateQuote: async (blockId, { month, day_range, year, lines }) => {
    const payload = normalizeQuoteLines(lines)

    const { error } = await supabase.rpc('update_quote_entry', {
      p_block_id: blockId,
      p_month: month || '',
      p_day_range: day_range || '',
      p_year: year ? Number(year) : null,
      p_lines: payload,
    })

    if (error) throw new Error(error.message)

    const { data: block } = await supabase
      .from('quote_blocks')
      .select('quotebook_id')
      .eq('id', blockId)
      .single()

    if (!block) throw new Error('Quote not found after update.')
    return api.getQuotes(block.quotebook_id)
  },

  deleteQuote: async (blockId) => {
    const { error } = await supabase.from('quote_blocks').delete().eq('id', blockId)
    if (error) throw new Error(error.message)
    return { message: 'Quote deleted.' }
  },
}

export { supabase, toAppUser, usernameFromAuthUser }
