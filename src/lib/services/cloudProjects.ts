import { supabase, type CloudProject } from '../supabase'

export class CloudProjectService {
  async uploadProject(file: File, projectName: string, author: string): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const fileBuffer = await file.arrayBuffer()
    const fileData = new Uint8Array(fileBuffer)

    const { data, error } = await supabase
      .from('projects')
      .insert({
        name: projectName,
        author: author,
        file_data: fileData,
        file_name: file.name,
        file_format: file.type || 'application/octet-stream',
        user_id: user.id
      })
      .select('id')
      .single()

    if (error) throw error
    return data.id
  }

  async getUserProjects(): Promise<CloudProject[]> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  async downloadProject(projectId: string): Promise<File> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (error) throw error
    if (!data) throw new Error('Project not found')

    const blob = new Blob([data.file_data], { type: data.file_format })
    return new File([blob], data.file_name, { type: data.file_format })
  }

  async deleteProject(projectId: string): Promise<void> {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId)

    if (error) throw error
  }

  async updateProject(projectId: string, updates: Partial<Pick<CloudProject, 'name' | 'author'>>): Promise<void> {
    const { error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', projectId)

    if (error) throw error
  }
}