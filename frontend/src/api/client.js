import { supabase } from '../lib/supabase'

async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', userId)
    .single()

  if (error) throw new Error(error.message)
  return data
}

async function toAppUser(authUser) {
  if (!authUser) return null

  const profile = await getProfile(authUser.id)
  return {
    id: authUser.id,
    email: authUser.email,
    username: profile.username,
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

  getQuotebook: async (quotebookId) => {
    const { data, error } = await supabase
      .rpc('get_quotebook_for_user', { p_quotebook_id: quotebookId })

    if (error) throw new Error(error.message)
    if (!data?.length) throw new Error('Quotebook not found or access denied.')
    return { quotebook: data[0] }
  },

  getQuotes: async (quotebookId) => {
    const { data, error } = await supabase
      .from('quote_blocks')
      .select(`
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
      `)
      .eq('quotebook_id', quotebookId)
      .order('created_at', { ascending: false })
      .order('line_order', { foreignTable: 'utterances', ascending: true })

    if (error) throw new Error(error.message)
    return { quotes: (data || []).map(formatQuoteBlock) }
  },

  addQuote: async (quotebookId, { month, day_range, year, lines }) => {
    const payload = (lines || [])
      .map((line) => ({
        quote: (line.quote || '').trim(),
        author: (line.author || '').trim(),
        context: (line.context || '').trim(),
        context_position: line.context_position || '',
      }))
      .filter((line) => line.quote)

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

  shareQuotebook: async (quotebookId, { email, role }) => {
    const { error } = await supabase.rpc('share_quotebook_with_email', {
      p_quotebook_id: quotebookId,
      p_friend_email: email,
      p_role: role,
    })

    if (error) throw new Error(error.message)
    return { message: `Successfully shared with ${email}.` }
  },

  deleteQuote: async (blockId) => {
    const { error } = await supabase.from('quote_blocks').delete().eq('id', blockId)
    if (error) throw new Error(error.message)
    return { message: 'Quote deleted.' }
  },
}

export { supabase, toAppUser }
