import { supabase, type PublicProject } from '../supabase'

export class ProjectStoreService {
  async getPublicProjects(): Promise<PublicProject[]> {
    if (!supabase) {
      throw new Error('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.')
    }

    const { data, error } = await supabase
      .from('public_projects')
      .select('id, name, author, description, file_url, video_url, created_at, download_count, play_count')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  async downloadProject(projectId: string): Promise<File> {
    if (!supabase) {
      throw new Error('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.')
    }

    const { data, error } = await supabase
      .from('public_projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (error) throw error
    if (!data) throw new Error('Project not found')

    // Increment download count (skip if column doesn't exist)
    try {
      await supabase
        .from('public_projects')
        .update({ download_count: (data.download_count || 0) + 1 })
        .eq('id', projectId)
    } catch (err) {
      console.warn('Could not update download count:', err)
    }

    // Fetch the file from the URL
    const response = await fetch(data.file_url)
    if (!response.ok) throw new Error('Failed to download file')
    
    const blob = await response.blob()
    
    // Extract filename from URL or use project name as fallback
    const urlParts = data.file_url.split('/')
    const fileName = urlParts[urlParts.length - 1] || `${data.name}.zip`
    
    return new File([blob], fileName, { type: blob.type })
  }

  async searchProjects(query: string): Promise<PublicProject[]> {
    if (!supabase) {
      throw new Error('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.')
    }

    const { data, error } = await supabase
      .from('public_projects')
      .select('id, name, author, description, file_url, video_url, created_at, download_count, play_count')
      .or(`name.ilike.%${query}%,author.ilike.%${query}%,description.ilike.%${query}%`)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }
}