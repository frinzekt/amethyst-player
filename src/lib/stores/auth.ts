import { writable } from 'svelte/store'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../supabase'

export const user = writable<User | null>(null)
export const session = writable<Session | null>(null)
export const loading = writable(true)

supabase.auth.onAuthStateChange((event, newSession) => {
  session.set(newSession)
  user.set(newSession?.user ?? null)
  loading.set(false)
})

export const signInWithGoogle = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google'
  })
  if (error) throw error
}

export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}