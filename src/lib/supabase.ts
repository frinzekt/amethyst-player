import { createClient } from '@supabase/supabase-js'
import { browser } from '$app/environment'

let supabase: ReturnType<typeof createClient> | null = null

if (browser) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  
  if (supabaseUrl && supabaseAnonKey) {
    try {
      supabase = createClient(supabaseUrl, supabaseAnonKey)
    } catch (error) {
      console.warn('Failed to initialize Supabase client:', error)
      supabase = null
    }
  }
}

export { supabase }

export interface PublicProject {
  id: string
  name: string
  author: string
  description: string
  file_url: string
  video_url: string | null
  created_at: string
  file_size?: number
  download_count?: number
  tags?: string[]
}

export interface SubmittedProject {
  id: string
  name: string
  author: string
  author_email?: string
  user_id: string
  description: string
  file_url: string
  video_url?: string | null
  tags?: string[]
  status: 'pending' | 'approved' | 'rejected'
  admin_notes?: string | null
  file_size?: number
  created_at: string
  reviewed_at?: string | null
  reviewed_by?: string | null
}